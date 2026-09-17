import { NextResponse } from "next/server";
import { listAllTasks, getCustomFieldValue, getCustomFieldNumber, resolveDropdownLabel } from "@/lib/clickup";
import { LISTS, LEADS_FIELDS } from "@/lib/clickup-field-ids";

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
}

// Real deals from the Leads list (901326738812) — the same list the website
// chatbot writes to, and the one with an actual native status workflow that
// maps to a 5-stage pipeline. No new ClickUp fields needed (see plan).
export async function GET() {
  const tasks = await listAllTasks(LISTS.leads);

  const deals: Deal[] = tasks.map((task) => {
    const stage = STATUS_TO_STAGE[task.status.status] ?? "lead";
    const value = getCustomFieldNumber(task, LEADS_FIELDS.estimatedBudget) ?? 0;
    const companyName = (getCustomFieldValue(task, LEADS_FIELDS.companyClientName) as string) ?? task.name;
    const leadSource = resolveDropdownLabel(task, LEADS_FIELDS.leadSource);
    const daysInStage = Math.floor((Date.now() - Number(task.date_updated)) / 86400000);
    return { clickupTaskId: task.id, name: task.name, companyName, value, leadSource, stage, daysInStage };
  });

  return NextResponse.json({ deals });
}
