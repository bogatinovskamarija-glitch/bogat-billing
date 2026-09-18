import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { fetchAllJournalLines } from "../../../lib/ledger";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // first-of-month, e.g. 2026-09-01
  if (!month) return NextResponse.json({ error: "month is required" }, { status: 400 });

  const monthEnd = new Date(month);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  const { data: accounts } = await supabaseAdmin.from("accounts").select("id, code, name").eq("type", "expense").order("code");
  const { data: budgetLines } = await supabaseAdmin.from("budget_lines").select("*").eq("month", month);
  const journalLines = await fetchAllJournalLines({ gte: month, lte: monthEndStr });

  const budgetMap = new Map((budgetLines || []).map((b) => [b.account_id, Number(b.budgeted_amount)]));

  const rows = (accounts || []).map((a) => {
    const lines = journalLines.filter((l) => l.account_id === a.id);
    const actual = lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
    return { accountId: a.id, code: a.code, name: a.name, budgeted: budgetMap.get(a.id) ?? 0, actual };
  });

  return NextResponse.json({ rows });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body?.accountId || !body?.month || body.budgetedAmount === undefined) {
    return NextResponse.json({ error: "accountId, month, budgetedAmount are required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("budget_lines")
    .upsert({ account_id: body.accountId, month: body.month, budgeted_amount: body.budgetedAmount }, { onConflict: "account_id,month" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
