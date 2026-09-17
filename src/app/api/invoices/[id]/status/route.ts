import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";

// Non-cash status transitions (draft -> sent, or -> void). Paid/partial are
// only ever set by the /payments route since they carry real cash movement.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (!["sent", "void", "draft"].includes(body.status)) {
    return NextResponse.json({ error: "status must be sent, void, or draft" }, { status: 400 });
  }
  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === "sent") patch.sent_date = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin.from("invoices").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
