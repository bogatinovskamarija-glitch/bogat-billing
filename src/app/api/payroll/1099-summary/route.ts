import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

const NEC_THRESHOLD = 600;

// Year-end 1099-NEC prep: how much each 1099-type employee was paid,
// sourced from posted expenses explicitly tagged to them via contractor_id
// (tagged on the Expenses screen — nothing here auto-detects a contractor
// from a description). Only crosses the $600 IRS threshold gets flagged;
// everyone else still shows so a near-miss doesn't go unnoticed.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || String(new Date().getFullYear());

  const { data: contractors } = await supabaseAdmin
    .from("employees")
    .select("id, name, role_title")
    .eq("employee_type", "1099");

  const { data: payments } = await supabaseAdmin
    .from("expenses")
    .select("amount, contractor_id, expense_date")
    .eq("direction", "out")
    .eq("status", "categorized")
    .not("contractor_id", "is", null)
    .gte("expense_date", `${year}-01-01`)
    .lte("expense_date", `${year}-12-31`);

  const totalsById = new Map<string, number>();
  (payments || []).forEach((p) => {
    totalsById.set(p.contractor_id as string, (totalsById.get(p.contractor_id as string) ?? 0) + Number(p.amount));
  });

  const summary = (contractors || []).map((c) => {
    const total = Math.round((totalsById.get(c.id) ?? 0) * 100) / 100;
    return { contractorId: c.id, name: c.name, roleTitle: c.role_title, total, requires1099: total >= NEC_THRESHOLD };
  });

  return NextResponse.json({ year, threshold: NEC_THRESHOLD, summary: summary.sort((a, b) => b.total - a.total) });
}
