import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";
import { getClientRevenueSummary } from "../../../../../lib/client-revenue";

// Cross-references a billing client with its real project + invoice history
// and live unbilled WIP — what the CRM contact drawer's "Billing" section
// renders for a contact linked to a `clients` row.
export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const { data: client, error } = await supabaseAdmin.from("clients").select("*").eq("id", params.id).single();
  if (error || !client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const summary = await getClientRevenueSummary(client);
  return NextResponse.json({ summary });
}
