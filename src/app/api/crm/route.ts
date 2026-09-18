import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { listAllTasks, getCustomFieldValue, getCustomFieldNumber, resolveDropdownLabel } from "../../../lib/clickup";
import { LISTS, CRM_FIELDS } from "../../../lib/clickup-field-ids";

export interface CrmContact {
  clickupTaskId: string;
  name: string;
  companyName: string | null;
  primaryContact: string | null;
  clientStatus: string | null;
  clientType: string | null;
  totalRevenueLifetime: number | null;
  supabaseId: string | null;
  tier: string | null;
  strength: number;
  lastTouchDate: string | null;
  nextTouchDate: string | null;
  referralPotential: string | null;
  workingNote: string | null;
  billingClientId: string | null;
  billedRevenue: number;
}

export async function GET() {
  // Only top-level tasks are real contacts — a subtask filed under a contact
  // (e.g. a project reference nested under a client) is not itself a client.
  const tasks = (await listAllTasks(LISTS.crm)).filter((t) => !t.parent);
  const { data: overlays } = await supabaseAdmin.from("crm_contacts").select("*");
  const overlayMap = new Map((overlays || []).map((o) => [o.clickup_task_id, o]));

  // A CRM contact linked to a billing `clients` row (see /api/clients/link-crm)
  // is what lets the drawer show real project/revenue data alongside the
  // CRM-only relationship fields.
  const { data: billingClients } = await supabaseAdmin.from("clients").select("id, clickup_crm_task_id").not("clickup_crm_task_id", "is", null);
  const billingClientMap = new Map((billingClients || []).map((c) => [c.clickup_crm_task_id as string, c.id as string]));

  // Real billed revenue per client (not the manually-maintained ClickUp
  // lifetime field), for the CRM page's "by client" chart.
  const { data: invoices } = await supabaseAdmin.from("invoices").select("client_id, total_amount").neq("status", "void");
  const billedByClientId = new Map<string, number>();
  (invoices || []).forEach((inv) => {
    if (!inv.client_id) return;
    billedByClientId.set(inv.client_id, (billedByClientId.get(inv.client_id) ?? 0) + Number(inv.total_amount));
  });

  const contacts: CrmContact[] = tasks.map((task) => {
    const overlay = overlayMap.get(task.id);
    const billingClientId = billingClientMap.get(task.id) ?? null;
    return {
      clickupTaskId: task.id,
      name: task.name,
      companyName: (getCustomFieldValue(task, CRM_FIELDS.companyName) as string) ?? null,
      primaryContact: (getCustomFieldValue(task, CRM_FIELDS.primaryContact) as string) ?? null,
      clientStatus: resolveDropdownLabel(task, CRM_FIELDS.clientStatus),
      clientType: resolveDropdownLabel(task, CRM_FIELDS.clientType),
      totalRevenueLifetime: getCustomFieldNumber(task, CRM_FIELDS.totalRevenueLifetime),
      supabaseId: overlay?.id ?? null,
      tier: overlay?.tier ?? null,
      strength: overlay?.strength ?? 3,
      lastTouchDate: overlay?.last_touch_date ?? null,
      nextTouchDate: overlay?.next_touch_date ?? null,
      referralPotential: overlay?.referral_potential ?? null,
      workingNote: overlay?.working_note ?? null,
      billingClientId,
      billedRevenue: billingClientId ? billedByClientId.get(billingClientId) ?? 0 : 0,
    };
  });

  return NextResponse.json({ contacts });
}
