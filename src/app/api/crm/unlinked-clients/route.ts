import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { listAllTasks, getCustomFieldValue } from "../../../../lib/clickup";
import { LISTS, CRM_FIELDS } from "../../../../lib/clickup-field-ids";

export interface UnlinkedCrmContact {
  clickupTaskId: string;
  name: string;
  companyName: string | null;
  primaryContact: string | null;
}

// ClickUp's CRM list is the source of truth for a client's identity — this
// returns the CRM contacts that don't have a billing `clients` row yet, so
// "+ New client" always traces back to a real CRM contact instead of typing
// one from scratch and ending up with a disconnected duplicate.
export async function GET() {
  const tasks = await listAllTasks(LISTS.crm);
  const { data: linked } = await supabaseAdmin
    .from("clients")
    .select("clickup_crm_task_id")
    .not("clickup_crm_task_id", "is", null);
  const linkedIds = new Set((linked || []).map((c) => c.clickup_crm_task_id));

  const contacts: UnlinkedCrmContact[] = tasks
    .filter((t) => !linkedIds.has(t.id))
    .map((t) => ({
      clickupTaskId: t.id,
      name: t.name,
      companyName: (getCustomFieldValue(t, CRM_FIELDS.companyName) as string) ?? null,
      primaryContact: (getCustomFieldValue(t, CRM_FIELDS.primaryContact) as string) ?? null,
    }));

  return NextResponse.json({ contacts });
}
