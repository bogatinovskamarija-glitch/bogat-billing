import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { listAllTasks } from "../../../../lib/clickup";
import { LISTS } from "../../../../lib/clickup-field-ids";

// Ensures every real ClickUp CRM contact has an overlay row (tier/strength/
// touch dates default to unset). Never overwrites an existing overlay —
// this only fills in gaps for contacts that are new since the last sync.
export async function POST() {
  const tasks = await listAllTasks(LISTS.crm);
  const { data: existing } = await supabaseAdmin.from("crm_contacts").select("clickup_task_id");
  const existingIds = new Set((existing || []).map((r) => r.clickup_task_id));

  const toInsert = tasks.filter((t) => !existingIds.has(t.id)).map((t) => ({ clickup_task_id: t.id }));
  if (toInsert.length > 0) {
    await supabaseAdmin.from("crm_contacts").insert(toInsert);
  }

  return NextResponse.json({ added: toInsert.length });
}
