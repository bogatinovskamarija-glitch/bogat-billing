import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { postJournalEntry } from "../../../../lib/ledger";

// Bulk-confirms every categorized-but-not-yet-posted expense that has a
// category assigned (skips any still missing one rather than guessing).
export async function POST() {
  const { data: expenses } = await supabaseAdmin
    .from("expenses")
    .select("*, accounts(code)")
    .eq("status", "uncategorized")
    .not("account_id", "is", null);

  let confirmed = 0;
  for (const expense of expenses || []) {
    const amount = Number(expense.amount);
    const lines =
      expense.direction === "in"
        ? [
            { accountCode: "1000", debit: amount },
            { accountCode: expense.accounts.code, credit: amount },
          ]
        : [
            { accountCode: expense.accounts.code, debit: amount },
            { accountCode: "1000", credit: amount },
          ];
    const journalEntryId = await postJournalEntry(expense.expense_date, expense.description, "expense", expense.id, lines);
    await supabaseAdmin.from("expenses").update({ status: "categorized", journal_entry_id: journalEntryId }).eq("id", expense.id);
    confirmed++;
  }

  return NextResponse.json({ confirmed });
}
