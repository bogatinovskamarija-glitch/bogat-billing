import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "../../../../lib/csv-parse";
import { suggestAccountCode } from "../../../../lib/expense-categorizer";
import { supabaseAdmin } from "../../../../lib/supabase";

function parseDate(raw: string): string | null {
  // Handles M/D/YYYY (Chase) and YYYY-MM-DD alike.
  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdY) return `${mdY[3]}-${mdY[1].padStart(2, "0")}-${mdY[2].padStart(2, "0")}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return raw.slice(0, 10);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const { csvText, mapping } = await req.json();
  if (!csvText || !mapping?.dateCol || !mapping?.descCol || !mapping?.amountCol) {
    return NextResponse.json({ error: "csvText and a full column mapping are required" }, { status: 400 });
  }

  const { headers, rows } = parseCsv(csvText);
  const idx = (col: string) => headers.indexOf(col);
  const dateIdx = idx(mapping.dateCol);
  const descIdx = idx(mapping.descCol);
  const amountIdx = idx(mapping.amountCol);
  const detailsIdx = mapping.detailsCol ? idx(mapping.detailsCol) : -1;

  const { data: accounts } = await supabaseAdmin.from("accounts").select("id, code");
  const codeToId = new Map((accounts || []).map((a) => [a.code, a.id]));

  const toInsert: any[] = [];
  for (const row of rows) {
    const rawAmount = (row[amountIdx] || "").replace(/[$,]/g, "");
    const amount = parseFloat(rawAmount);
    if (!Number.isFinite(amount)) continue;

    // Only money OUT is an expense. If a "Details" column exists (Chase),
    // trust DEBIT/CREDIT explicitly; otherwise fall back to sign.
    const isExpense = detailsIdx >= 0 ? (row[detailsIdx] || "").trim().toUpperCase() === "DEBIT" : amount < 0;
    if (!isExpense) continue;

    const expenseDate = parseDate((row[dateIdx] || "").trim());
    if (!expenseDate) continue;

    const description = (row[descIdx] || "").trim();
    const suggestedCode = suggestAccountCode(description);

    toInsert.push({
      expense_date: expenseDate,
      description,
      amount: Math.abs(amount),
      account_id: codeToId.get(suggestedCode) ?? null,
      source: "csv_import",
      raw_csv_row: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
      status: "uncategorized",
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, expenses: [] });
  }

  const { data, error } = await supabaseAdmin.from("expenses").insert(toInsert).select("*, accounts(code, name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data.length, expenses: data });
}
