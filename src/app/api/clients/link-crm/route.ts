import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTask, getCustomFieldValue } from "@/lib/clickup";
import { CRM_FIELDS } from "@/lib/clickup-field-ids";

// Creates a billing `clients` row from an existing ClickUp CRM contact,
// instead of typing a client's identity from scratch — CRM stays the one
// source of truth for who a client is; this only adds the row so the
// billing-specific fields CRM doesn't track (phone, address, rate) have
// somewhere to live. If the contact is already linked, returns that row
// untouched rather than overwriting any billing details already entered.
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.clickupTaskId) return NextResponse.json({ error: "clickupTaskId is required" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("clickup_crm_task_id", body.clickupTaskId)
    .maybeSingle();
  if (existing) return NextResponse.json({ client: existing });

  const task = await getTask(body.clickupTaskId);
  const companyName = (getCustomFieldValue(task, CRM_FIELDS.companyName) as string) ?? null;
  const primaryContact = (getCustomFieldValue(task, CRM_FIELDS.primaryContact) as string) ?? null;

  // The CRM task's own title is an action-item label (e.g. "Manage Rivera
  // Development Group account"), not the client's actual name — prefer the
  // Company Name custom field, and only fall back to the task title when
  // that field is empty.
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .insert({
      clickup_crm_task_id: task.id,
      name: companyName || task.name,
      company_name: companyName,
      contact_name: primaryContact,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client });
}
