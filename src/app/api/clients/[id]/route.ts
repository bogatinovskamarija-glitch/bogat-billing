import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

const FIELD_MAP: Record<string, string> = {
  name: "name",
  companyName: "company_name",
  contactName: "contact_name",
  contactEmail: "contact_email",
  contactPhone: "contact_phone",
  billingAddress: "billing_address",
  defaultHourlyRate: "default_hourly_rate",
};

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) patch[column] = body[key];
  }

  const { data, error } = await supabaseAdmin.from("clients").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
