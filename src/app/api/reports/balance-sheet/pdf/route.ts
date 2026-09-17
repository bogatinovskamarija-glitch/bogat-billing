import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabase";
import StatementDocument, { StatementPdfData } from "@/pdf/StatementDocument";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const asOf = req.nextUrl.searchParams.get("asOf") || new Date().toISOString().slice(0, 10);

  const { data: accounts } = await supabaseAdmin.from("accounts").select("id, name, type, normal_balance");
  const { data: lines } = await supabaseAdmin
    .from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(entry_date)")
    .lte("journal_entries.entry_date", asOf);

  const balanceFor = (acct: { id: string; normal_balance: string }) => {
    const acctLines = (lines || []).filter((l: any) => l.account_id === acct.id);
    const debit = acctLines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const credit = acctLines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    return acct.normal_balance === "debit" ? debit - credit : credit - debit;
  };

  const rows = (accounts || []).map((a) => ({ ...a, balance: balanceFor(a) }));
  const assets = rows.filter((r) => r.type === "asset" && r.balance !== 0);
  const liabilities = rows.filter((r) => r.type === "liability" && r.balance !== 0);
  const equityAccounts = rows.filter((r) => r.type === "equity" && r.balance !== 0);
  const netIncomeToDate =
    rows.filter((r) => r.type === "revenue").reduce((s, r) => s + r.balance, 0) -
    rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.balance, 0);

  const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
  const totalEquity = equityAccounts.reduce((s, r) => s + r.balance, 0) + netIncomeToDate;

  const data: StatementPdfData = {
    title: "Balance Sheet",
    subtitle: `As of ${asOf}`,
    sections: [
      { title: "Assets", rows: assets.map((a) => ({ label: a.name, value: a.balance })), total: { label: "Total Assets", value: totalAssets } },
      { title: "Liabilities", rows: liabilities.map((l) => ({ label: l.name, value: l.balance })), total: { label: "Total Liabilities", value: totalLiabilities } },
      {
        title: "Equity",
        rows: [...equityAccounts.map((e) => ({ label: e.name, value: e.balance })), { label: "Retained Earnings (net income to date)", value: netIncomeToDate }],
        total: { label: "Total Equity", value: totalEquity },
      },
    ],
    grandTotal: { label: "Assets = Liabilities + Equity", value: totalAssets },
  };

  const buffer = await renderToBuffer(StatementDocument({ data }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="balance-sheet-${asOf}.pdf"` },
  });
}
