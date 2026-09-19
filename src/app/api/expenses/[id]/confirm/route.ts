import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";
import { postJournalEntry } from "../../../../../lib/ledger";

export async function POST(_req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const { data: expense, error } = await supabaseAdmin.from("expenses").select("*, accounts(code)").eq("id", params.id).single();
  if (error || !expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  if (!expense.account_id) return NextResponse.json({ error: "Pick a category first" }, { status: 400 });
  if (expense.status === "categorized") return NextResponse.json({ ok: true, alreadyConfirmed: true });

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

  await supabaseAdmin.from("expenses").update({ status: "categorized", journal_entry_id: journalEntryId }).eq("id", params.id);
  return NextResponse.json({ ok: true, journalEntryId });
}
