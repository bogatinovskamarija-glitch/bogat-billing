import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";
import { postJournalEntry } from "../../../../../lib/ledger";

// Records a (possibly partial) payment against an invoice: Dr Cash / Cr
// Accounts Receivable. Flips the invoice to 'paid' once fully covered,
// 'partial' otherwise — this is the "mark Sent/Paid" action referenced in
// earlier planning that hadn't actually been built until the ledger needed it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (!body?.amount || !body?.paidDate) {
    return NextResponse.json({ error: "amount and paidDate are required" }, { status: 400 });
  }

  const { data: invoice, error } = await supabaseAdmin.from("invoices").select("*").eq("id", params.id).single();
  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const journalEntryId = await postJournalEntry(
    body.paidDate,
    `Payment received — ${invoice.invoice_number}`,
    "invoice_paid",
    invoice.id,
    [
      { accountCode: "1000", debit: body.amount, memo: "Cash received" },
      { accountCode: "1100", credit: body.amount, memo: "Accounts Receivable" },
    ]
  );

  await supabaseAdmin.from("invoice_payments").insert({
    invoice_id: invoice.id,
    amount: body.amount,
    paid_date: body.paidDate,
    journal_entry_id: journalEntryId,
  });

  const newPaidAmount = Math.round((Number(invoice.paid_amount) + Number(body.amount)) * 100) / 100;
  const newStatus = newPaidAmount >= Number(invoice.total_amount) ? "paid" : "partial";

  await supabaseAdmin
    .from("invoices")
    .update({ paid_amount: newPaidAmount, status: newStatus })
    .eq("id", invoice.id);

  return NextResponse.json({ ok: true, journalEntryId, status: newStatus, paidAmount: newPaidAmount });
}
