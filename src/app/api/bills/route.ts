import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { postJournalEntry } from "../../../lib/ledger";

// Accrual-side tracking, separate from the cash-basis expenses table: a
// bill is owed the moment it's entered (Dr expense / Cr Accounts Payable),
// not when it's paid. Marking it paid is a second entry (Dr Accounts
// Payable / Cr Cash) via PATCH /api/bills/[id].
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("bills")
    .select("*, accounts(code, name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bills: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.vendorName || !body?.billDate || !body?.amount || !body?.accountId) {
    return NextResponse.json({ error: "vendorName, billDate, amount, and accountId are required" }, { status: 400 });
  }

  const { data: account } = await supabaseAdmin.from("accounts").select("code").eq("id", body.accountId).single();
  if (!account) return NextResponse.json({ error: "Unknown account" }, { status: 400 });

  const amount = Math.abs(Number(body.amount));
  const description = `Bill — ${body.vendorName}${body.description ? `: ${body.description}` : ""}`;

  const { data: bill, error: insertError } = await supabaseAdmin
    .from("bills")
    .insert({
      vendor_name: body.vendorName,
      description: body.description || null,
      bill_date: body.billDate,
      due_date: body.dueDate || null,
      amount,
      account_id: body.accountId,
      status: "unpaid",
    })
    .select("id")
    .single();
  if (insertError || !bill) return NextResponse.json({ error: insertError?.message || "Failed to create bill" }, { status: 500 });

  const journalEntryId = await postJournalEntry(body.billDate, description, "bill", bill.id, [
    { accountCode: account.code, debit: amount },
    { accountCode: "2000", credit: amount },
  ]);

  await supabaseAdmin.from("bills").update({ bill_journal_entry_id: journalEntryId }).eq("id", bill.id);

  const { data: full } = await supabaseAdmin.from("bills").select("*, accounts(code, name)").eq("id", bill.id).single();
  return NextResponse.json({ bill: full });
}
