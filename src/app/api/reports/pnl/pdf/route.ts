import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "../../../../../lib/supabase";
import { fetchAllJournalLines } from "../../../../../lib/ledger";
import StatementDocument, { StatementPdfData } from "../../../../../pdf/StatementDocument";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start") || `${new Date().getFullYear()}-01-01`;
  const end = req.nextUrl.searchParams.get("end") || new Date().toISOString().slice(0, 10);

  const { data: accounts } = await supabaseAdmin.from("accounts").select("id, name, type, normal_balance").in("type", ["revenue", "expense"]);
  const lines = await fetchAllJournalLines({ gte: start, lte: end });

  const rows = (accounts || []).map((acct) => {
    const acctLines = lines.filter((l) => l.account_id === acct.id);
    const debit = acctLines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const credit = acctLines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    const balance = acct.normal_balance === "debit" ? debit - credit : credit - debit;
    return { ...acct, balance };
  });

  const revenue = rows.filter((r) => r.type === "revenue" && r.balance !== 0);
  const expenses = rows.filter((r) => r.type === "expense" && r.balance !== 0);
  const totalRevenue = revenue.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.balance, 0);

  const data: StatementPdfData = {
    title: "Profit & Loss",
    subtitle: `${start} to ${end}`,
    sections: [
      { title: "Revenue", rows: revenue.map((r) => ({ label: r.name, value: r.balance })), total: { label: "Total Revenue", value: totalRevenue } },
      { title: "Expenses", rows: expenses.map((r) => ({ label: r.name, value: r.balance })), total: { label: "Total Expenses", value: totalExpenses } },
    ],
    grandTotal: { label: "Net Income", value: totalRevenue - totalExpenses },
  };

  // See paystubs/[id]/pdf/route.ts for why this cast is here.
  const buffer = await renderToBuffer(createElement(StatementDocument, { data }) as any);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="pnl-${start}-to-${end}.pdf"` },
  });
}
