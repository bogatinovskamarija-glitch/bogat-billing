import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const CADENCE_DAYS: Record<string, number> = { A: 14, B: 21, C: 30 };

// Upserts the CRM overlay for one contact (by ClickUp task id, not the
// Supabase row id, so the client never needs a separate "create overlay"
// step before it can edit a contact it just saw from /api/crm).
export async function PATCH(req: NextRequest, { params }: { params: { clickupTaskId: string } }) {
  const body = await req.json();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.tier !== undefined) patch.tier = body.tier;
  if (body.strength !== undefined) patch.strength = body.strength;
  if (body.referralPotential !== undefined) patch.referral_potential = body.referralPotential;
  if (body.workingNote !== undefined) patch.working_note = body.workingNote;

  if (body.logTouch) {
    const today = new Date();
    const cadence = CADENCE_DAYS[body.tier as string] ?? 30;
    const next = new Date(today);
    next.setDate(next.getDate() + cadence);
    patch.last_touch_date = today.toISOString().slice(0, 10);
    patch.next_touch_date = next.toISOString().slice(0, 10);
  }

  const { data, error } = await supabaseAdmin
    .from("crm_contacts")
    .upsert({ clickup_task_id: params.clickupTaskId, ...patch }, { onConflict: "clickup_task_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
