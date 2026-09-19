import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

// Recategorize (or edit date/description/amount) before confirming — once
// an expense is confirmed/posted, edit via a manual adjusting entry instead.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { data: existing } = await supabaseAdmin.from("expenses").select("status").eq("id", params.id).single();
  if (existing?.status === "categorized") {
    return NextResponse.json({ error: "Already confirmed and posted — can't edit in place" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.accountId !== undefined) patch.account_id = body.accountId;
  if (body.description !== undefined) patch.description = body.description;
  if (body.amount !== undefined) patch.amount = body.amount;
  if (body.expenseDate !== undefined) patch.expense_date = body.expenseDate;
  if (body.contractorId !== undefined) patch.contractor_id = body.contractorId || null;

  const { data, error } = await supabaseAdmin.from("expenses").update(patch).eq("id", params.id).select("*, accounts(code, name)").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: existing } = await supabaseAdmin.from("expenses").select("status").eq("id", params.id).single();
  if (existing?.status === "categorized") {
    return NextResponse.json({ error: "Already confirmed and posted — can't delete" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("expenses").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
