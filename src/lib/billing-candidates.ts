import { supabaseAdmin } from "./supabase";
import { listTasksByStatus, getTaskTimeEntries, getTaskComments, billableHours } from "./clickup";
import { buildProgressNarrative } from "./narrative";
import type { ProjectPhaseBilling } from "./supabase";

// Known limitation (see plan §4): "done" detection only recognizes these two
// ClickUp statuses, the ones observed on Arraigo. A project list using a
// differently-named closed status won't surface its Not Billed tasks until
// this is generalized.
const DONE_STATUSES = ["complete", "bill"];
const READY_STATUS = "bill";

export type BillingStatus = "not_billed" | "ready_to_invoice" | "invoiced";
export type BoardTab = "ready" | "unbilled" | "all";

export interface CandidateTask {
  clickupTaskId: string;
  clickupListId: string;
  taskName: string;
  taskCustomId: string | null;
  closedDate: string | null;
  hours: number;
  hourlyRate: number;
  amount: number;
  progressNarrative: string;
  billingStatus: BillingStatus;
  invoiceNumber: string | null;
  projectId: string;
  phase: string | null;
}

export interface CandidateProject {
  projectId: string;
  projectName: string;
  currentPhase: string | null;
  tasks: CandidateTask[];
}

export interface CandidateClient {
  clientId: string;
  clientName: string;
  projects: CandidateProject[];
  accumulatedTotal: number;
  taskCount: number;
}

async function getInvoicedTaskMap(): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from("invoice_line_items")
    .select("clickup_task_id, invoices(invoice_number)");
  const map = new Map<string, string>();
  (data || []).forEach((row: any) => {
    if (row.invoices?.invoice_number) map.set(row.clickup_task_id, row.invoices.invoice_number);
  });
  return map;
}

function statusFor(clickupStatus: string, invoicedMap: Map<string, string>, taskId: string): BillingStatus {
  if (invoicedMap.has(taskId)) return "invoiced";
  if (clickupStatus === READY_STATUS) return "ready_to_invoice";
  return "not_billed";
}

function tabIncludes(tab: BoardTab, status: BillingStatus): boolean {
  if (tab === "all") return true;
  if (tab === "ready") return status === "ready_to_invoice";
  return status === "not_billed";
}

// Builds one client's board data: its active projects' done-ish ClickUp
// tasks, tagged with the 3-status model and filtered to the requested tab.
// Only tasks that survive the tab filter get the (expensive) time-entry +
// comment fetch.
export async function getCandidatesForClient(
  client: { id: string; name: string; default_hourly_rate: number | null },
  projects: { id: string; name: string; current_phase: string | null; clickup_list_id: string | null; hourly_rate: number | null }[],
  tab: BoardTab,
  invoicedMap: Map<string, string>
): Promise<CandidateClient> {
  const resultProjects: CandidateProject[] = [];
  let accumulatedTotal = 0;
  let taskCount = 0;

  for (const project of projects) {
    if (!project.clickup_list_id) continue;

    const rawTasks = await listTasksByStatus(project.clickup_list_id, DONE_STATUSES);
    const rate = project.hourly_rate ?? client.default_hourly_rate ?? 0;

    const tasks: CandidateTask[] = [];
    for (const task of rawTasks) {
      const billingStatus = statusFor(task.status.status, invoicedMap, task.id);
      if (!tabIncludes(tab, billingStatus)) continue;

      const [entries, comments] = await Promise.all([
        getTaskTimeEntries(task.id),
        getTaskComments(task.id),
      ]);
      const hours = billableHours(entries);
      const amount = Math.round(hours * rate * 100) / 100;

      tasks.push({
        clickupTaskId: task.id,
        clickupListId: project.clickup_list_id,
        taskName: task.name,
        taskCustomId: task.custom_id,
        closedDate: task.date_closed,
        hours,
        hourlyRate: rate,
        amount,
        progressNarrative: buildProgressNarrative(comments),
        billingStatus,
        invoiceNumber: invoicedMap.get(task.id) ?? null,
        projectId: project.id,
        phase: project.current_phase,
      });

      if (billingStatus !== "invoiced") {
        accumulatedTotal += amount;
        taskCount += 1;
      }
    }

    if (tasks.length > 0) {
      resultProjects.push({
        projectId: project.id,
        projectName: project.name,
        currentPhase: project.current_phase,
        tasks,
      });
    }
  }

  return {
    clientId: client.id,
    clientName: client.name,
    projects: resultProjects,
    accumulatedTotal: Math.round(accumulatedTotal * 100) / 100,
    taskCount,
  };
}

export interface MilestonePhase extends ProjectPhaseBilling {
  amount: number;
}

export interface MilestoneProject {
  projectId: string;
  projectName: string;
  currentPhase: string | null;
  contractValue: number;
  clientId: string;
  clientName: string;
  phases: MilestonePhase[];
}

// Active percentage_phase projects with a client and contract value set, plus
// their phase breakdown — the Billing Board's Milestone Billing section.
// Unlike getCandidatesForClient this never touches ClickUp: phases and their
// percentages live entirely in Supabase, keyed off the project's own row.
export async function getMilestoneProjects(): Promise<MilestoneProject[]> {
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name, current_phase, contract_value, client_id, clients(id, name)")
    .eq("is_active", true)
    .eq("billing_type", "percentage_phase")
    .not("client_id", "is", null);

  const results: MilestoneProject[] = [];
  for (const project of (projects || []) as any[]) {
    const contractValue = Number(project.contract_value) || 0;
    const { data: phases } = await supabaseAdmin
      .from("project_phase_billing")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order");

    results.push({
      projectId: project.id,
      projectName: project.name,
      currentPhase: project.current_phase,
      contractValue,
      clientId: project.client_id,
      clientName: project.clients?.name ?? "—",
      phases: (phases || []).map((p) => ({
        ...p,
        amount: Math.round(contractValue * (Number(p.percent_of_contract) / 100) * 100) / 100,
      })),
    });
  }

  return results;
}

export { getInvoicedTaskMap };
