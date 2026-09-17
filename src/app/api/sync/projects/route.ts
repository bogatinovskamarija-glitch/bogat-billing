import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getList,
  getTask,
  listAllTasks,
  getCustomFieldValue,
  getCustomFieldNumber,
  resolveDropdownLabel,
  normalizeProjectKey,
  ClickUpTaskFull,
} from "@/lib/clickup";
import { LISTS, PROJECT_SUMMARY_FIELDS } from "@/lib/clickup-field-ids";
import { KNOWN_PROJECT_LISTS } from "@/lib/known-project-lists";

interface LinkedTaskRef {
  id: string;
  name?: string;
}

// Manual "sync projects" action (Phase A — no ClickUp writes, read + upsert
// into Supabase only). Walks the known project-list registry, matches each
// to its Projects-list summary task by normalized name, and upserts a thin
// `projects` row. If the summary task has a Client relationship set, also
// upserts a `clients` row and links it — otherwise leaves client_id null
// (expected pre-revenue: most projects have no client assigned yet).
export async function POST() {
  const summaryTasks = await listAllTasks(LISTS.projects);
  const synced: { listId: string; name: string; matched: boolean; clientAssigned: boolean }[] = [];

  for (const known of KNOWN_PROJECT_LISTS) {
    const list = await getList(known.clickupListId);
    const key = normalizeProjectKey(list.name);
    const summaryTask = summaryTasks.find((t) => normalizeProjectKey(t.name) === key);

    let clientId: string | null = null;
    let clientAssigned = false;

    if (summaryTask) {
      const clientRefs = getCustomFieldValue(summaryTask, PROJECT_SUMMARY_FIELDS.clientRelationship) as
        | LinkedTaskRef[]
        | null
        | undefined;

      if (clientRefs && clientRefs.length > 0) {
        const ref = clientRefs[0];
        let clientName = ref.name;
        if (!clientName) {
          const crmTask = await getTask(ref.id).catch(() => null);
          clientName = crmTask?.name;
        }
        if (clientName) {
          const { data: upsertedClient } = await supabaseAdmin
            .from("clients")
            .upsert(
              { clickup_crm_task_id: ref.id, name: clientName },
              { onConflict: "clickup_crm_task_id" }
            )
            .select("id")
            .single();
          clientId = upsertedClient?.id ?? null;
          clientAssigned = !!clientId;
        }
      }
    }

    const hourlyRate = summaryTask ? getCustomFieldNumber(summaryTask, PROJECT_SUMMARY_FIELDS.hourlyRate) : null;
    const currentPhase = summaryTask
      ? resolveDropdownLabel(summaryTask, PROJECT_SUMMARY_FIELDS.currentPhase)
      : null;
    const contractValue = summaryTask ? getCustomFieldNumber(summaryTask, PROJECT_SUMMARY_FIELDS.contractValue) : null;

    await supabaseAdmin.from("projects").upsert(
      {
        clickup_list_id: known.clickupListId,
        clickup_folder_id: known.clickupFolderId,
        clickup_project_task_id: summaryTask?.id ?? null,
        name: list.name,
        current_phase: currentPhase,
        hourly_rate: hourlyRate,
        contract_value: contractValue,
        is_active: known.isActive,
        client_id: clientId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "clickup_list_id" }
    );

    synced.push({ listId: known.clickupListId, name: list.name, matched: !!summaryTask, clientAssigned });
  }

  return NextResponse.json({ synced });
}
