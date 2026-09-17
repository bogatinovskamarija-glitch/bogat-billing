import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listAllTasks, getCustomFieldValue, getCustomFieldNumber, resolveDropdownLabel } from "@/lib/clickup";
import { LISTS, CRM_FIELDS } from "@/lib/clickup-field-ids";

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
}

export async function GET() {
  const tasks = await listAllTasks(LISTS.crm);
  const { data: overlays } = await supabaseAdmin.from("crm_contacts").select("*");
  const overlayMap = new Map((overlays || []).map((o) => [o.clickup_task_id, o]));

  const contacts: CrmContact[] = tasks.map((task) => {
    const overlay = overlayMap.get(task.id);
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
    };
  });

  return NextResponse.json({ contacts });
}
