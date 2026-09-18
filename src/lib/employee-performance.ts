import { supabaseAdmin } from "./supabase";
import { listTasksByStatus, getTaskTimeEntries, getUserTimeEntries, totalHours, ClickUpTimeEntry } from "./clickup";
import { DONE_STATUSES } from "./billing-candidates";

export interface EmployeePerformance {
  employeeId: string;
  name: string;
  roleTitle: string | null;
  employeeType: string;
  hoursWorked: number;
  billableHours: number;
  revenueGenerated: number;
  cost: number | null;
  margin: number | null;
}

interface EmployeeRow {
  id: string;
  name: string;
  role_title: string | null;
  employee_type: string;
  clickup_user_id: string | null;
  hourly_rate: number | null;
  annual_salary: number | null;
  billing_rate: number | null;
}

// Per-employee hours/billable/revenue/cost/margin for a date range. Three
// data sources, all already used elsewhere in the app:
//  - hoursWorked: every ClickUp time entry in the range, regardless of task
//    status (same call payroll's regular/OT split uses).
//  - billableHours/revenueGenerated: the same "done" task traversal the
//    Billing Board uses (listTasksByStatus + per-task time entries), just
//    restricted to tasks closed within the range and tallied by employee
//    across every project instead of by client. Skips the comments fetch
//    that traversal normally makes — not needed here.
//  - cost: hourly_rate × hoursWorked for w2_hourly; annual_salary prorated
//    by days-in-range for w2_salary. 1099/owner_draw have no reliable
//    automatic cost basis, so cost/margin stay null for them.
export async function getEmployeePerformance(startDate: string, endDate: string): Promise<EmployeePerformance[]> {
  const startMs = new Date(startDate + "T00:00:00").getTime();
  const endMs = new Date(endDate + "T23:59:59.999").getTime();

  const { data: employees } = await supabaseAdmin
    .from("employees")
    .select("id, name, role_title, employee_type, clickup_user_id, hourly_rate, annual_salary, billing_rate")
    .eq("is_active", true);
  const employeeRows = (employees || []) as EmployeeRow[];
  const employeesByClickupId = new Map<string, EmployeeRow>();
  employeeRows.forEach((e) => {
    if (e.clickup_user_id) employeesByClickupId.set(e.clickup_user_id, e);
  });

  // Total hours worked, one call per employee for the whole range.
  const hoursWorkedById = new Map<string, number>();
  await Promise.all(
    employeeRows
      .filter((e) => e.clickup_user_id)
      .map(async (e) => {
        const entries = await getUserTimeEntries(e.clickup_user_id!, startMs, endMs);
        hoursWorkedById.set(e.id, totalHours(entries));
      })
  );

  // Billable hours + revenue generated: walk every active project's "done"
  // tasks closed in the range, weight each task's time entries by employee.
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, client_id, clickup_list_id, hourly_rate")
    .eq("is_active", true)
    .not("clickup_list_id", "is", null);
  const { data: clients } = await supabaseAdmin.from("clients").select("id, default_hourly_rate");
  const clientRateById = new Map((clients || []).map((c) => [c.id, c.default_hourly_rate as number | null]));

  const billableHoursById = new Map<string, number>();
  const revenueById = new Map<string, number>();

  for (const project of projects || []) {
    if (!project.clickup_list_id) continue;
    const fallbackRate = project.hourly_rate ?? clientRateById.get(project.client_id) ?? 0;
    const rawTasks = await listTasksByStatus(project.clickup_list_id, DONE_STATUSES);

    for (const task of rawTasks) {
      if (!task.date_closed) continue;
      const closedMs = Number(task.date_closed);
      if (closedMs < startMs || closedMs > endMs) continue;

      const entries = await getTaskTimeEntries(task.id);
      const byUser = new Map<string, ClickUpTimeEntry[]>();
      entries.forEach((e) => {
        const key = e.user ? String(e.user.id) : "unknown";
        if (!byUser.has(key)) byUser.set(key, []);
        byUser.get(key)!.push(e);
      });

      byUser.forEach((groupEntries, userId) => {
        const employee = employeesByClickupId.get(userId);
        if (!employee) return; // not a tracked employee — not attributable
        const hrs = totalHours(groupEntries);
        if (hrs === 0) return;
        const rate = employee.billing_rate ?? fallbackRate;
        const amount = Math.round(hrs * rate * 100) / 100;
        billableHoursById.set(employee.id, (billableHoursById.get(employee.id) ?? 0) + hrs);
        revenueById.set(employee.id, (revenueById.get(employee.id) ?? 0) + amount);
      });
    }
  }

  const daysInRange = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

  const results: EmployeePerformance[] = employeeRows.map((e) => {
    const hoursWorked = hoursWorkedById.get(e.id) ?? 0;
    const billableHours = Math.round((billableHoursById.get(e.id) ?? 0) * 100) / 100;
    const revenueGenerated = Math.round((revenueById.get(e.id) ?? 0) * 100) / 100;

    let cost: number | null = null;
    if (e.employee_type === "w2_hourly" && e.hourly_rate) {
      cost = Math.round(hoursWorked * Number(e.hourly_rate) * 100) / 100;
    } else if (e.employee_type === "w2_salary" && e.annual_salary) {
      cost = Math.round(Number(e.annual_salary) * (daysInRange / 365) * 100) / 100;
    }

    return {
      employeeId: e.id,
      name: e.name,
      roleTitle: e.role_title,
      employeeType: e.employee_type,
      hoursWorked,
      billableHours,
      revenueGenerated,
      cost,
      margin: cost !== null ? Math.round((revenueGenerated - cost) * 100) / 100 : null,
    };
  });

  return results.sort((a, b) => (b.margin ?? b.revenueGenerated) - (a.margin ?? a.revenueGenerated));
}
