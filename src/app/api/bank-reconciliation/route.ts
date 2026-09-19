import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { fetchAllJournalLines } from "../../../lib/ledger";

const CASH_ACCOUNT_CODE = "1000";

async function getLedgerCashBalance(): Promise<number> {
  const { data: cashAccount } = await supabaseAdmin.from("accounts").select("id").eq("code", CASH_ACCOUNT_CODE).single();
  if (!cashAccount) return 0;
  const lines = await fetchAllJournalLines();
  const balance = lines
    .filter((l) => l.account_id === cashAccount.id)
    .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  return Math.round(balance * 100) / 100;
}

// Periodic "does the ledger match the real bank balance" check — the
// safeguard against exactly the kind of drift (duplicate CSV imports going
// undetected for a year) that corrupted the balance sheet before this
// existed. Each save is a dated snapshot, not a live recompute of history,
// so past reconciliations stay a record of what was actually verified when.
export async function GET() {
  const ledgerBalance = await getLedgerCashBalance();
  const { data: history, error } = await supabaseAdmin
    .from("bank_reconciliations")
    .select("*")
    .order("reconciliation_date", { ascending: false })
    .limit(24);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ledgerBalance, history: history || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.reconciliationDate || body?.statementBalance === undefined) {
    return NextResponse.json({ error: "reconciliationDate and statementBalance are required" }, { status: 400 });
  }

  const ledgerBalance = await getLedgerCashBalance();
  const statementBalance = Math.round(Number(body.statementBalance) * 100) / 100;
  const difference = Math.round((statementBalance - ledgerBalance) * 100) / 100;

  const { data, error } = await supabaseAdmin
    .from("bank_reconciliations")
    .insert({
      reconciliation_date: body.reconciliationDate,
      statement_balance: statementBalance,
      ledger_balance: ledgerBalance,
      difference,
      notes: body.notes || null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reconciliation: data });
}
