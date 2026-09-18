import { supabaseAdmin } from "./supabase";
import { getCandidatesForClient, getInvoicedTaskMap, getTaskOverrides, getBillableEmployees } from "./billing-candidates";
import type { Client } from "./supabase";

export interface ProjectRevenue {
  id: string;
  name: string;
  currentPhase: string | null;
  contractValue: number | null;
  billed: number;
  collected: number;
}

export interface ClientRevenueSummary {
  clientId: string;
  projects: ProjectRevenue[];
  totalContractValue: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  wipUnbilled: number;
}

// Billed/collected per project, from real invoice line items. Shared by the
// Overview "by project" table and the CRM client-detail view so this
// aggregation exists in exactly one place.
export async function getProjectRevenue(projectIds: string[]): Promise<Map<string, { billed: number; collected: number }>> {
  const map = new Map<string, { billed: number; collected: number }>();
  for (const id of projectIds) map.set(id, { billed: 0, collected: 0 });
  if (projectIds.length === 0) return map;

  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("project_id, amount, invoices(status)")
    .in("project_id", projectIds);

  for (const item of (lineItems || []) as any[]) {
    const entry = map.get(item.project_id);
    if (!entry) continue;
    entry.billed += Number(item.amount);
    if (item.invoices?.status === "paid") entry.collected += Number(item.amount);
  }
  return map;
}

export interface BilledCollectedYTD {
  billedYTD: number;
  collectedYTD: number;
}

// Firm-wide billed/collected for the current calendar year — shared by the
// Overview page's hero tiles and the Billing Board's YTD reference line so
// both read the exact same number.
export async function getBilledCollectedYTD(): Promise<BilledCollectedYTD> {
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("total_amount, status, issued_date")
    .neq("status", "void")
    .gte("issued_date", yearStart);

  const billedYTD = (invoices || []).reduce((s, i) => s + Number(i.total_amount), 0);
  const collectedYTD = (invoices || []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0);
  return { billedYTD, collectedYTD };
}

// Full revenue picture for one billing client: their projects, each
// project's billed/collected (real invoice history), and current unbilled
// WIP (live from ClickUp — same aggregation the Billing Board uses).
export async function getClientRevenueSummary(client: Client): Promise<ClientRevenueSummary> {
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name, current_phase, contract_value, clickup_list_id, hourly_rate, is_active")
    .eq("client_id", client.id);

  const projectRows = projects || [];
  const revenueMap = await getProjectRevenue(projectRows.map((p) => p.id));

  const projectSummaries: ProjectRevenue[] = projectRows.map((p) => {
    const rev = revenueMap.get(p.id) ?? { billed: 0, collected: 0 };
    return {
      id: p.id,
      name: p.name,
      currentPhase: p.current_phase,
      contractValue: p.contract_value ? Number(p.contract_value) : null,
      billed: rev.billed,
      collected: rev.collected,
    };
  });

  const totalBilled = projectSummaries.reduce((s, p) => s + p.billed, 0);
  const totalCollected = projectSummaries.reduce((s, p) => s + p.collected, 0);
  const totalContractValue = projectSummaries.reduce((s, p) => s + (p.contractValue ?? 0), 0);

  let wipUnbilled = 0;
  const activeProjects = projectRows.filter((p) => p.is_active && p.clickup_list_id);
  if (activeProjects.length > 0) {
    const invoicedMap = await getInvoicedTaskMap();
    const overridesMap = await getTaskOverrides();
    const employees = await getBillableEmployees();
    const unbilled = await getCandidatesForClient(client, activeProjects, "unbilled", invoicedMap, employees, overridesMap);
    wipUnbilled = unbilled.accumulatedTotal;
  }

  return {
    clientId: client.id,
    projects: projectSummaries,
    totalContractValue,
    totalBilled,
    totalCollected,
    totalOutstanding: totalBilled - totalCollected,
    wipUnbilled,
  };
}
