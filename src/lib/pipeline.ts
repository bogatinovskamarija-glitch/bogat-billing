import { listAllTasks, getCustomFieldValue, getCustomFieldNumber, resolveDropdownLabel } from "./clickup";
import { LISTS, LEADS_FIELDS } from "./clickup-field-ids";

export type Stage = "lead" | "qualified" | "proposal_sent" | "won" | "lost";

const STATUS_TO_STAGE: Record<string, Stage> = {
  "not started": "lead",
  qualifying: "qualified",
  "discovery call": "qualified",
  "proposal sent": "proposal_sent",
  won: "won",
  disqualified: "lost",
};

export interface Deal {
  clickupTaskId: string;
  name: string;
  companyName: string;
  value: number;
  leadSource: string | null;
  stage: Stage;
  daysInStage: number;
  isOutlier: boolean;
}

// Real deals from the Leads list (901326738812) — the same list the website
// chatbot writes to, and the one with an actual native status workflow that
// maps to a 5-stage pipeline. Shared by /api/pipeline and the Overview
// homepage's pipeline widget so both read the exact same computation.
export async function getDeals(): Promise<Deal[]> {
  const tasks = await listAllTasks(LISTS.leads);

  const rawDeals = tasks.map((task) => {
    const stage = STATUS_TO_STAGE[task.status.status] ?? "lead";
    const value = getCustomFieldNumber(task, LEADS_FIELDS.estimatedBudget) ?? 0;
    const companyName = (getCustomFieldValue(task, LEADS_FIELDS.companyClientName) as string) ?? task.name;
    const leadSource = resolveDropdownLabel(task, LEADS_FIELDS.leadSource);
    const daysInStage = Math.floor((Date.now() - Number(task.date_updated)) / 86400000);
    return { clickupTaskId: task.id, name: task.name, companyName, value, leadSource, stage, daysInStage };
  });

  // Flag (never silently drop or clamp) any deal whose Estimated Budget
  // alone dominates the open pipeline — a raw ClickUp field value that's
  // more likely a typo/placeholder than a real deal size, but only she can
  // confirm that in ClickUp. A median-based check breaks down here: most
  // real deals in this list have no Estimated Budget entered at all (value
  // 0), so one real six-figure deal IS the median once zeros are excluded,
  // and never looks like an outlier next to itself. Comparing each deal's
  // share of the total instead catches "one deal is most of the pipeline"
  // regardless of how many zero-value deals surround it.
  const openDeals = rawDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const openTotal = openDeals.reduce((s, d) => s + d.value, 0);
  const outlierIds = new Set(
    openDeals.filter((d) => d.value > 0 && openTotal > 0 && d.value / openTotal > 0.4).map((d) => d.clickupTaskId)
  );
  return rawDeals.map((d) => ({ ...d, isOutlier: outlierIds.has(d.clickupTaskId) }));
}

export interface OpenPipelineSummary {
  openValue: number;
  dealCount: number;
  bySource: { label: string; value: number }[];
}

export async function getOpenPipelineSummary(): Promise<OpenPipelineSummary> {
  const deals = await getDeals();
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");

  const bySourceMap = new Map<string, number>();
  open.forEach((d) => {
    const key = d.leadSource ?? "Unknown source";
    bySourceMap.set(key, (bySourceMap.get(key) ?? 0) + d.value);
  });
  const bySource = Array.from(bySourceMap.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return { openValue: open.reduce((s, d) => s + d.value, 0), dealCount: open.length, bySource };
}
