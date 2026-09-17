import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("clients").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}

// Manual client creation — used until a project's ClickUp CRM
// "Client" relationship is set and the sync can pick it up automatically.
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      name: body.name,
      company_name: body.companyName ?? null,
      contact_name: body.contactName ?? null,
      contact_email: body.contactEmail ?? null,
      contact_phone: body.contactPhone ?? null,
      billing_address: body.billingAddress ?? null,
      default_hourly_rate: body.defaultHourlyRate ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}
