import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("expenses")
    .select("*, accounts(code, name)")
    .order("expense_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data });
}

// Single manual entry — same row shape /api/expenses/import inserts. Still
// lands in "uncategorized" (pending review) even though she picked the
// category herself, because that status is what gates posting the journal
// entry in POST /api/expenses/[id]/confirm — an expense isn't in the ledger
// until she hits Confirm, manual or CSV-imported alike.
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.expenseDate || !body?.description || body?.amount === undefined || !body?.accountId) {
    return NextResponse.json({ error: "expenseDate, description, amount, and accountId are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("expenses")
    .insert({
      expense_date: body.expenseDate,
      description: body.description,
      amount: Math.abs(Number(body.amount)),
      account_id: body.accountId,
      source: "manual",
      status: "uncategorized",
    })
    .select("*, accounts(code, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
