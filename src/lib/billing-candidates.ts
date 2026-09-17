import { supabaseAdmin } from "./supabase";
import { listTasksByStatus, getTaskTimeEntries, getTaskComments, totalHours, ClickUpTimeEntry } from "./clickup";
import { buildProgressNarrative } from "./narrative";
import type { ProjectPhaseBilling } from "./supabase";

export interface BillableEmployee {
  id: string;
  name: string;
  roleTitle: string | null;
  clickupUserId: string | null;
  billingRate: number | null;
}

export interface TaskOverride {
  hoursOverride: number | null;
  rateOverride: number | null;
}

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
  rateBreakdown: string | null;
  hasOverride: boolean;
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

async function getBillableEmployees(): Promise<BillableEmployee[]> {
  const { data } = await supabaseAdmin.from("employees").select("id, name, role_title, clickup_user_id, billing_rate");
  return (data || []).map((e) => ({
    id: e.id,
    name: e.name,
    roleTitle: e.role_title,
    clickupUserId: e.clickup_user_id,
    billingRate: e.billing_rate === null ? null : Number(e.billing_rate),
  }));
}

async function getTaskOverrides(): Promise<Map<string, TaskOverride>> {
  const { data } = await supabaseAdmin.from("task_billing_overrides").select("*");
  const map = new Map<string, TaskOverride>();
  (data || []).forEach((row: any) => {
    map.set(row.clickup_task_id, {
      hoursOverride: row.hours_override === null ? null : Number(row.hours_override),
      rateOverride: row.rate_override === null ? null : Number(row.rate_override),
    });
  });
  return map;
}

// Weighted rate by who actually logged the time — an employee's own
// billing_rate (what's charged to clients) if their ClickUp user is known,
// otherwise the project/client fallback rate. Returns the total amount plus
// a human-readable breakdown for transparency on the invoice.
function computeWeightedAmount(
  entries: ClickUpTimeEntry[],
  employeesByClickupId: Map<string, BillableEmployee>,
  fallbackRate: number
): { hours: number; amount: number; breakdown: string | null } {
  const byUser = new Map<string, ClickUpTimeEntry[]>();
  entries.forEach((e) => {
    const key = e.user ? String(e.user.id) : "unknown";
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key)!.push(e);
  });

  let totalHoursSum = 0;
  let totalAmount = 0;
  const parts: string[] = [];

  byUser.forEach((groupEntries, userId) => {
    const hours = totalHours(groupEntries);
    if (hours === 0) return;
    const employee = employeesByClickupId.get(userId);
    const rate = employee?.billingRate ?? fallbackRate;
    const amount = Math.round(hours * rate * 100) / 100;
    totalHoursSum += hours;
    totalAmount += amount;

    const label = employee ? `${employee.name}${employee.roleTitle ? ` (${employee.roleTitle})` : ""}` : groupEntries[0]?.user?.username ?? "Unassigned";
    // 2 decimals here (not the 1-decimal display convention used elsewhere)
    // so this h × rate note always multiplies out to exactly the shown
    // amount — a rounded-looking "1.0h" next to $153.00 would look wrong.
    parts.push(`${label}: ${hours.toFixed(2)}h × $${rate.toFixed(2)}/hr`);
  });

  return {
    hours: Math.round(totalHoursSum * 100) / 100,
    amount: Math.round(totalAmount * 100) / 100,
    breakdown: parts.length > 0 ? parts.join("; ") : null,
  };
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
  invoicedMap: Map<string, string>,
  employees: BillableEmployee[],
  overridesMap: Map<string, TaskOverride>
): Promise<CandidateClient> {
  const employeesByClickupId = new Map<string, BillableEmployee>();
  employees.forEach((e) => {
    if (e.clickupUserId) employeesByClickupId.set(e.clickupUserId, e);
  });

  const resultProjects: CandidateProject[] = [];
  let accumulatedTotal = 0;
  let taskCount = 0;

  for (const project of projects) {
    if (!project.clickup_list_id) continue;

    const rawTasks = await listTasksByStatus(project.clickup_list_id, DONE_STATUSES);
    const fallbackRate = project.hourly_rate ?? client.default_hourly_rate ?? 0;

    const tasks: CandidateTask[] = [];
    for (const task of rawTasks) {
      const billingStatus = statusFor(task.status.status, invoicedMap, task.id);
      if (!tabIncludes(tab, billingStatus)) continue;

      const [entries, comments] = await Promise.all([
        getTaskTimeEntries(task.id),
        getTaskComments(task.id),
      ]);
      // ClickUp's per-entry "billable" toggle isn't part of her workflow —
      // most real entries come through unchecked (or via automation) — so
      // the task's own "bill" status is the actual billing gate, not this
      // flag. Using billableHours() here was silently zeroing out real,
      // tracked time on every task.
      const computed = computeWeightedAmount(entries, employeesByClickupId, fallbackRate);

      const override = overridesMap.get(task.id);
      const hasOverride = !!(override && (override.hoursOverride !== null || override.rateOverride !== null));
      let hours = computed.hours;
      let amount = computed.amount;
      let rateBreakdown = computed.breakdown;
      let hourlyRate = hours > 0 ? Math.round((amount / hours) * 100) / 100 : fallbackRate;

      if (hasOverride) {
        hours = override!.hoursOverride ?? computed.hours;
        hourlyRate = override!.rateOverride ?? hourlyRate;
        amount = Math.round(hours * hourlyRate * 100) / 100;
        rateBreakdown = "Manually adjusted";
      }

      tasks.push({
        clickupTaskId: task.id,
        clickupListId: project.clickup_list_id,
        taskName: task.name,
        taskCustomId: task.custom_id,
        closedDate: task.date_closed,
        hours,
        hourlyRate,
        amount,
        rateBreakdown,
        hasOverride,
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

export { getInvoicedTaskMap, getTaskOverrides, getBillableEmployees };
