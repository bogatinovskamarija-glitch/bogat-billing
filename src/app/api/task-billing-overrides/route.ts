import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// A manual, persisted correction to one task's computed hours/rate on the
// Billing Board — same trust model as PTO-hours-used on a draft pay run.
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.clickupTaskId) return NextResponse.json({ error: "clickupTaskId is required" }, { status: 400 });

  // Editing just hours (or just rate) must not clobber the other field's
  // existing override, so merge onto whatever's already there.
  const { data: existing } = await supabaseAdmin
    .from("task_billing_overrides")
    .select("*")
    .eq("clickup_task_id", body.clickupTaskId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("task_billing_overrides").upsert({
    clickup_task_id: body.clickupTaskId,
    hours_override: body.hoursOverride !== undefined ? body.hoursOverride : existing?.hours_override ?? null,
    rate_override: body.rateOverride !== undefined ? body.rateOverride : existing?.rate_override ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Resets a task back to its computed hours/rate.
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body?.clickupTaskId) return NextResponse.json({ error: "clickupTaskId is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("task_billing_overrides").delete().eq("clickup_task_id", body.clickupTaskId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
