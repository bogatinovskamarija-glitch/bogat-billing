import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

function csvField(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Raw general-ledger export for handing to a CPA — every real (non-test)
// journal line, one row per debit/credit, with the entry it belongs to and
// the account it hit. Complements the formatted Balance Sheet/P&L PDFs,
// which summarize; this is the underlying detail a tax preparer actually
// wants to see.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let query = supabaseAdmin
    .from("journal_lines")
    .select("debit, credit, memo, journal_entries!inner(entry_date, description, source_type, is_test), accounts(code, name, type)")
    .eq("journal_entries.is_test", false)
    .order("entry_date", { referencedTable: "journal_entries", ascending: true });
  if (start) query = query.gte("journal_entries.entry_date", start);
  if (end) query = query.lte("journal_entries.entry_date", end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = ["Date", "Description", "Source", "Account Code", "Account Name", "Account Type", "Debit", "Credit", "Memo"];
  const lines = [header.join(",")];
  for (const row of (data || []) as any[]) {
    const entry = row.journal_entries;
    lines.push(
      [
        entry.entry_date,
        csvField(entry.description),
        entry.source_type,
        row.accounts?.code ?? "",
        csvField(row.accounts?.name ?? ""),
        row.accounts?.type ?? "",
        Number(row.debit).toFixed(2),
        Number(row.credit).toFixed(2),
        csvField(row.memo ?? ""),
      ].join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="bogat-general-ledger${start ? `_${start}_to_${end || "now"}` : ""}.csv"`,
    },
  });
}
