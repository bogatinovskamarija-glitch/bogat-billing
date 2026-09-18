import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";

export interface EmployeeYtd {
  employeeId: string;
  ytdGross: number;
  ytdNet: number;
  ytdHours: number;
}

// Per-employee YTD, from finalized paystubs only (a draft run's figures
// aren't real payroll yet) — same "finalized only" gate used everywhere
// else YTD is computed in this app.
export async function GET() {
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { data: stubs } = await supabaseAdmin
    .from("paystubs")
    .select("employee_id, gross_pay, net_pay, regular_hours, overtime_hours, pay_runs!inner(status, pay_date)")
    .eq("pay_runs.status", "finalized")
    .gte("pay_runs.pay_date", yearStart);

  const map = new Map<string, EmployeeYtd>();
  for (const row of (stubs || []) as any[]) {
    const entry = map.get(row.employee_id) ?? { employeeId: row.employee_id, ytdGross: 0, ytdNet: 0, ytdHours: 0 };
    entry.ytdGross += Number(row.gross_pay);
    entry.ytdNet += Number(row.net_pay);
    entry.ytdHours += Number(row.regular_hours) + Number(row.overtime_hours);
    map.set(row.employee_id, entry);
  }

  return NextResponse.json({ ytd: Array.from(map.values()) });
}
