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
import { LISTS, PROJECT_SUMMARY_FIELDS, BILLING_MODEL_OPTIONS, DEFAULT_PHASE_BREAKDOWN } from "@/lib/clickup-field-ids";
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
    const billingModelRaw = summaryTask
      ? (getCustomFieldValue(summaryTask, PROJECT_SUMMARY_FIELDS.billingModel) as string | null | undefined)
      : null;
    const billingType = billingModelRaw ? BILLING_MODEL_OPTIONS[billingModelRaw] : undefined;

    const { data: upserted } = await supabaseAdmin
      .from("projects")
      .upsert(
        {
          clickup_list_id: known.clickupListId,
          clickup_folder_id: known.clickupFolderId,
          clickup_project_task_id: summaryTask?.id ?? null,
          name: list.name,
          current_phase: currentPhase,
          hourly_rate: hourlyRate,
          contract_value: contractValue,
          ...(billingType ? { billing_type: billingType } : {}),
          is_active: known.isActive,
          client_id: clientId,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "clickup_list_id" }
      )
      .select("id")
      .single();

    // Seed the default phase breakdown the first time a project is synced as
    // percentage_phase — never re-seeds once phases exist, since she edits
    // these to match the real fee agreement.
    if (billingType === "percentage_phase" && upserted) {
      const { count } = await supabaseAdmin
        .from("project_phase_billing")
        .select("id", { count: "exact", head: true })
        .eq("project_id", upserted.id);
      if (!count) {
        await supabaseAdmin.from("project_phase_billing").insert(
          DEFAULT_PHASE_BREAKDOWN.map((phase, index) => ({
            project_id: upserted.id,
            phase_name: phase.phaseName,
            percent_of_contract: phase.percentOfContract,
            sort_order: index,
          }))
        );
      }
    }

    synced.push({ listId: known.clickupListId, name: list.name, matched: !!summaryTask, clientAssigned });
  }

  return NextResponse.json({ synced });
}
