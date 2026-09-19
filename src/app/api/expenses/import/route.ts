import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "../../../../lib/csv-parse";
import { suggestAccountCode } from "../../../../lib/expense-categorizer";
import { supabaseAdmin } from "../../../../lib/supabase";
import { parseImportDate, directionFromAmount, dedupeKey } from "../../../../lib/expense-import";

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

  const { data: accounts } = await supabaseAdmin.from("accounts").select("id, code");
  const codeToId = new Map((accounts || []).map((a) => [a.code, a.id]));

  // Every existing row's (date, description, amount) — re-importing the
  // same statement, or an overlapping date range, must not silently double
  // every transaction the way it did before. A bank CSV importer is the
  // one place this app should assume "run more than once" is the normal
  // case, not the exception.
  const { data: existingRows } = await supabaseAdmin.from("expenses").select("expense_date, description, amount");
  const existingKeys = new Set((existingRows || []).map((e) => dedupeKey(e.expense_date, e.description, Number(e.amount))));

  const toInsert: any[] = [];
  let skippedDuplicates = 0;
  for (const row of rows) {
    const rawAmount = (row[amountIdx] || "").replace(/[$,]/g, "");
    const amount = parseFloat(rawAmount);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const expenseDate = parseImportDate((row[dateIdx] || "").trim());
    if (!expenseDate) continue;

    const description = (row[descIdx] || "").trim();
    const absAmount = Math.abs(amount);
    const direction = directionFromAmount(amount);

    const key = dedupeKey(expenseDate, description, absAmount);
    if (existingKeys.has(key)) {
      skippedDuplicates++;
      continue;
    }
    existingKeys.add(key); // also guards against the same row appearing twice within one file

    const suggestedCode = suggestAccountCode(description, direction);

    toInsert.push({
      expense_date: expenseDate,
      description,
      amount: absAmount,
      direction,
      account_id: codeToId.get(suggestedCode) ?? null,
      source: "csv_import",
      raw_csv_row: Object.fromEntries(headers.map((h, i) => [h, row[i]])),
      status: "uncategorized",
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skippedDuplicates, expenses: [] });
  }

  const { data, error } = await supabaseAdmin.from("expenses").insert(toInsert).select("*, accounts(code, name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data.length, skippedDuplicates, expenses: data });
}
