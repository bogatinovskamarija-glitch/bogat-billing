import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_PHASE_BREAKDOWN } from "@/lib/clickup-field-ids";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, billing_type, contract_value")
    .eq("id", params.projectId)
    .single();
  if (error || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: phases } = await supabaseAdmin
    .from("project_phase_billing")
    .select("*")
    .eq("project_id", params.projectId)
    .order("sort_order");

  return NextResponse.json({ project, phases: phases || [] });
}

// Sets billing_type and/or replaces the phase breakdown. Editing phases
// replaces the whole set (this is a fee-schedule template, not a ledger —
// nothing here is immutable until a phase is actually billed, at which point
// invoice_line_items.phase_billing_id's unique index stops it being reused).
export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  const body = await req.json();

  if (body.billingType) {
    const { error } = await supabaseAdmin.from("projects").update({ billing_type: body.billingType }).eq("id", params.projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (body.billingType === "percentage_phase") {
      const { count } = await supabaseAdmin
        .from("project_phase_billing")
        .select("id", { count: "exact", head: true })
        .eq("project_id", params.projectId);
      if (!count) {
        await supabaseAdmin.from("project_phase_billing").insert(
          DEFAULT_PHASE_BREAKDOWN.map((phase, index) => ({
            project_id: params.projectId,
            phase_name: phase.phaseName,
            percent_of_contract: phase.percentOfContract,
            sort_order: index,
          }))
        );
      }
    }
  }

  if (Array.isArray(body.phases)) {
    for (const [index, phase] of body.phases.entries()) {
      if (phase.id) {
        await supabaseAdmin
          .from("project_phase_billing")
          .update({ phase_name: phase.phaseName, percent_of_contract: phase.percentOfContract, sort_order: index })
          .eq("id", phase.id)
          .neq("status", "billed");
      } else {
        await supabaseAdmin.from("project_phase_billing").insert({
          project_id: params.projectId,
          phase_name: phase.phaseName,
          percent_of_contract: phase.percentOfContract,
          sort_order: index,
        });
      }
    }
  }

  const { data: phases } = await supabaseAdmin
    .from("project_phase_billing")
    .select("*")
    .eq("project_id", params.projectId)
    .order("sort_order");

  return NextResponse.json({ phases: phases || [] });
}
