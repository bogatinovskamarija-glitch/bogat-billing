import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

// Lightweight project listing for the Billing Board's "Project Billing
// Setup" picker — every active, client-assigned project with its current
// billing model, regardless of what that model is (unlike the Billing Board
// itself, which only surfaces hourly/percentage_phase projects).
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, billing_type, contract_value, clients(name)")
    .eq("is_active", true)
    .not("client_id", "is", null)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}
