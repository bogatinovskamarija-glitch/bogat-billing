import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { postJournalEntry } from "../../../../lib/ledger";

// Marks a bill paid: Dr Accounts Payable / Cr Cash, dated whenever it was
// actually paid (not the original bill date).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { data: bill, error } = await supabaseAdmin.from("bills").select("*").eq("id", params.id).single();
  if (error || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });

  const paidDate = body?.paidDate || new Date().toISOString().slice(0, 10);
  const journalEntryId = await postJournalEntry(paidDate, `Payment — ${bill.vendor_name}`, "bill_paid", bill.id, [
    { accountCode: "2000", debit: Number(bill.amount) },
    { accountCode: "1000", credit: Number(bill.amount) },
  ]);

  await supabaseAdmin
    .from("bills")
    .update({ status: "paid", paid_date: paidDate, payment_journal_entry_id: journalEntryId })
    .eq("id", params.id);

  return NextResponse.json({ ok: true, journalEntryId });
}

// Only an unpaid bill can be deleted — it also reverses the accrual entry
// that was posted when it was created, since nothing should ever leave a
// dangling journal entry behind.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: bill, error } = await supabaseAdmin.from("bills").select("*").eq("id", params.id).single();
  if (error || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "paid") return NextResponse.json({ error: "Already paid — can't delete" }, { status: 400 });

  if (bill.bill_journal_entry_id) {
    await supabaseAdmin.from("journal_lines").delete().eq("journal_entry_id", bill.bill_journal_entry_id);
    await supabaseAdmin.from("journal_entries").delete().eq("id", bill.bill_journal_entry_id);
  }
  await supabaseAdmin.from("bills").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
