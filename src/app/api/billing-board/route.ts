import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCandidatesForClient, getInvoicedTaskMap, getMilestoneProjects, BoardTab, CandidateClient } from "@/lib/billing-candidates";

// Aggregated Billing Board: every client's active-project candidate tasks,
// grouped, in one response — the mockup's single multi-client board rather
// than a client-picker → per-client detail flow.
export async function GET(req: NextRequest) {
  const tab = (req.nextUrl.searchParams.get("tab") as BoardTab) || "ready";

  const { data: clients, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id, name, default_hourly_rate");
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 });

  const { data: projects, error: projectsError } = await supabaseAdmin
    .from("projects")
    .select("id, name, current_phase, clickup_list_id, hourly_rate, client_id")
    .eq("is_active", true)
    .eq("billing_type", "hourly")
    .not("client_id", "is", null);
  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });

  const invoicedMap = await getInvoicedTaskMap();

  const results: CandidateClient[] = [];
  for (const client of clients || []) {
    const clientProjects = (projects || []).filter((p) => p.client_id === client.id);
    if (clientProjects.length === 0) continue;
    const candidate = await getCandidatesForClient(client, clientProjects, tab, invoicedMap);
    if (candidate.projects.length > 0) results.push(candidate);
  }

  const milestoneProjects = await getMilestoneProjects();

  return NextResponse.json({ clients: results, milestoneProjects });
}
