import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Toggles a phase between not_started and ready_to_bill — the same
// deliberate, manual signal that ClickUp's "bill" task status is for hourly
// tasks. "billed" is a terminal state only invoice generation sets.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (body.status !== "not_started" && body.status !== "ready_to_bill") {
    return NextResponse.json({ error: "status must be not_started or ready_to_bill" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("project_phase_billing")
    .update({ status: body.status })
    .eq("id", params.id)
    .neq("status", "billed")
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Phase not found or already billed" }, { status: 400 });
  return NextResponse.json({ phase: data });
}
