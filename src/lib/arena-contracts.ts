import { supabaseAdmin } from "./supabase";
import { postJournalEntry } from "./ledger";
import { addMonths, buildSchedule, monthlyValue } from "./arena-schedule";

export interface NewPrepaidContract {
  subscriberName: string;
  startDate: string; // the day the customer paid — service starts here
  termMonths: number;
  totalAmount: number; // gross amount the customer was charged
  processingFee?: number; // total Stripe fees on the charge (card + invoice fees)
  stripeInvoiceId?: string;
  stripeCustomerId?: string;
  notes?: string;
  isTest?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Records a prepaid AREna contract the accrual way:
//   at payment  — Dr Stripe Undeposited Funds (net of fees)
//                 Dr Payment Processing Fees
//                 Cr Deferred Revenue (gross) — a liability, not income yet
//   each month  — Dr Deferred Revenue / Cr AREna AI Revenue, dated the day
//                 that month of service is completed
// Every installment is posted now with its future date. Reports and the KPI
// views only count entries dated today or earlier, so each month's revenue
// appears on its own date without any job having to run.
export async function createPrepaidContract(input: NewPrepaidContract): Promise<{ id: string; entryIds: string[] }> {
  const total = round2(input.totalAmount);
  const fee = round2(input.processingFee || 0);
  if (!input.subscriberName?.trim()) throw new Error("Subscriber name is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("Start date must be YYYY-MM-DD");
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 60) throw new Error("Term must be 1-60 whole months");
  if (!(total > 0)) throw new Error("Total amount must be greater than zero");
  if (fee < 0 || fee >= total) throw new Error("Processing fee must be between zero and the total");

  const isTest = !!input.isTest;
  const schedule = buildSchedule(input.startDate, input.termMonths, total);

  const { data: sub, error: subError } = await supabaseAdmin
    .from("arena_subscriptions")
    .insert({
      subscriber_name: input.subscriberName.trim(),
      plan_type: "prepaid",
      contract_start: input.startDate,
      contract_end: addMonths(input.startDate, input.termMonths),
      term_months: input.termMonths,
      total_amount: total,
      monthly_amount: monthlyValue(total, input.termMonths),
      processing_fee: fee,
      stripe_invoice_id: input.stripeInvoiceId || null,
      stripe_customer_id: input.stripeCustomerId || null,
      notes: input.notes || null,
      is_test: isTest,
    })
    .select("id")
    .single();
  if (subError || !sub) throw new Error(subError?.message || "Failed to create contract");

  const entryIds: string[] = [];
  try {
    const signupLines = [
      { accountCode: "1050", debit: round2(total - fee), memo: "Collected via Stripe, not yet paid out" },
      ...(fee > 0 ? [{ accountCode: "6830", debit: fee, memo: "Stripe fees on this charge" }] : []),
      { accountCode: "2200", credit: total, memo: `${input.termMonths} months of AREna service, not yet earned` },
    ];
    const signupId = await postJournalEntry(
      input.startDate,
      `AREna ${input.termMonths}-month prepayment — ${input.subscriberName.trim()}`,
      "arena_signup",
      sub.id,
      signupLines,
      isTest
    );
    entryIds.push(signupId);

    const scheduleRows = [];
    for (const row of schedule) {
      const entryId = await postJournalEntry(
        row.recognitionDate,
        `AREna revenue ${row.periodNumber}/${input.termMonths} — ${input.subscriberName.trim()}`,
        "arena_recognition",
        `${sub.id}:${row.periodNumber}`,
        [
          { accountCode: "2200", debit: row.amount },
          { accountCode: "4100", credit: row.amount },
        ],
        isTest
      );
      entryIds.push(entryId);
      scheduleRows.push({
        subscription_id: sub.id,
        period_number: row.periodNumber,
        recognition_date: row.recognitionDate,
        amount: row.amount,
        journal_entry_id: entryId,
      });
    }

    const { error: schedError } = await supabaseAdmin.from("arena_subscription_schedule").insert(scheduleRows);
    if (schedError) throw new Error(schedError.message);
    const { error: linkError } = await supabaseAdmin.from("arena_subscriptions").update({ signup_journal_entry_id: signupId }).eq("id", sub.id);
    if (linkError) throw new Error(linkError.message);
  } catch (err) {
    // Never leave a half-posted contract behind in the ledger.
    await supabaseAdmin.from("arena_subscriptions").delete().eq("id", sub.id);
    if (entryIds.length) {
      await supabaseAdmin.from("journal_lines").delete().in("journal_entry_id", entryIds);
      await supabaseAdmin.from("journal_entries").delete().in("id", entryIds);
    }
    throw err;
  }

  return { id: sub.id as string, entryIds };
}

// Removes a contract and every journal entry it created (signup + all
// installments), for correcting a mistaken entry or a refunded signup.
export async function deleteContract(id: string): Promise<void> {
  const { data: sub } = await supabaseAdmin.from("arena_subscriptions").select("signup_journal_entry_id").eq("id", id).single();
  if (!sub) throw new Error("Contract not found");
  const { data: sched } = await supabaseAdmin.from("arena_subscription_schedule").select("journal_entry_id").eq("subscription_id", id);

  const entryIds = [sub.signup_journal_entry_id, ...(sched || []).map((s) => s.journal_entry_id)].filter(Boolean) as string[];

  const { error } = await supabaseAdmin.from("arena_subscriptions").delete().eq("id", id); // schedule rows cascade
  if (error) throw new Error(error.message);
  if (entryIds.length) {
    await supabaseAdmin.from("journal_lines").delete().in("journal_entry_id", entryIds);
    await supabaseAdmin.from("journal_entries").delete().in("id", entryIds);
  }
}
