import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listTasksByStatus, getTaskTimeEntries, getTaskComments, billableHours } from "@/lib/clickup";
import { buildProgressNarrative } from "@/lib/narrative";
import { BILLING_READY_STATUS } from "@/lib/clickup-field-ids";

export interface CandidateTask {
  clickupTaskId: string;
  clickupListId: string;
  taskName: string;
  hours: number;
  hourlyRate: number;
  amount: number;
  progressNarrative: string;
}

export interface CandidateProject {
  projectId: string;
  projectName: string;
  currentPhase: string | null;
  tasks: CandidateTask[];
}

// Billing Review candidates for one client: ClickUp tasks at status "bill"
// across the client's active projects, minus anything already invoiced
// (Supabase invoice_line_items is the transactional gate — see plan §3).
export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, name, default_hourly_rate")
    .eq("id", params.clientId)
    .single();
  if (clientError || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: projects, error: projectsError } = await supabaseAdmin
    .from("projects")
    .select("id, name, current_phase, clickup_list_id, hourly_rate")
    .eq("client_id", client.id)
    .eq("is_active", true);
  if (projectsError) {
    return NextResponse.json({ error: projectsError.message }, { status: 500 });
  }

  const { data: alreadyInvoiced } = await supabaseAdmin
    .from("invoice_line_items")
    .select("clickup_task_id");
  const invoicedTaskIds = new Set((alreadyInvoiced || []).map((r) => r.clickup_task_id));

  const result: CandidateProject[] = [];

  for (const project of projects || []) {
    if (!project.clickup_list_id) continue;

    const rawTasks = await listTasksByStatus(project.clickup_list_id, BILLING_READY_STATUS);
    const candidateTasks = rawTasks.filter((t) => !invoicedTaskIds.has(t.id));

    const rate = project.hourly_rate ?? client.default_hourly_rate ?? 0;
    const tasks: CandidateTask[] = [];

    for (const task of candidateTasks) {
      const [entries, comments] = await Promise.all([
        getTaskTimeEntries(task.id),
        getTaskComments(task.id),
      ]);
      const hours = billableHours(entries);
      tasks.push({
        clickupTaskId: task.id,
        clickupListId: project.clickup_list_id,
        taskName: task.name,
        hours,
        hourlyRate: rate,
        amount: Math.round(hours * rate * 100) / 100,
        progressNarrative: buildProgressNarrative(comments),
      });
    }

    if (tasks.length > 0) {
      result.push({
        projectId: project.id,
        projectName: project.name,
        currentPhase: project.current_phase,
        tasks,
      });
    }
  }

  return NextResponse.json({ client: { id: client.id, name: client.name }, projects: result });
}
