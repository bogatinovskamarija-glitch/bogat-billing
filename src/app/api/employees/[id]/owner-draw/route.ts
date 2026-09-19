import { NextRequest, NextResponse } from "next/server";
import { postJournalEntry } from "../../../../../lib/ledger";

// A distribution, not a wage — no tax withholding, doesn't touch the
// payroll tax engine at all. Whether owner's draws are the right treatment
// for this LLC (vs. a reasonable W-2 salary) is a question for Maria's CPA,
// not something this app decides.
export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const body = await req.json();
  if (!body?.amount || !body?.date) {
    return NextResponse.json({ error: "amount and date are required" }, { status: 400 });
  }

  const journalEntryId = await postJournalEntry(body.date, "Owner's draw", "owner_draw", params.id, [
    { accountCode: "3100", debit: body.amount, memo: "Member draw" },
    { accountCode: "1000", credit: body.amount, memo: "Cash out" },
  ]);

  return NextResponse.json({ ok: true, journalEntryId });
}
