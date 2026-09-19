import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase";

export async function GET(_req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const { data: run, error } = await supabaseAdmin.from("pay_runs").select("*").eq("id", params.id).single();
  if (error || !run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const { data: paystubs } = await supabaseAdmin
    .from("paystubs")
    .select("*, employees(name, role_title, employee_type)")
    .eq("pay_run_id", params.id);

  return NextResponse.json({ run, paystubs: paystubs || [] });
}
