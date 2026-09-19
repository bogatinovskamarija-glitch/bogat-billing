import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";

// Manually links a synced project to a client — needed for projects whose
// ClickUp "Client" relationship isn't set yet (e.g. pre-revenue/speculative
// work), since the sync can't infer a client on its own in that case.
export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ projectId: string }> }) {
  const params = await paramsPromise;
  const body = await req.json();
  if (!body?.clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ client_id: body.clientId })
    .eq("id", params.projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
