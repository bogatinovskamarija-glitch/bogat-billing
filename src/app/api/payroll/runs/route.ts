import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computePaystub, Employee } from "@/lib/payroll-run";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("pay_runs").select("*").order("period_start", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data });
}

// Creates a draft run and computes a paystub for every active employee
// (excluding owner_draw, which is a separate action, not a wage run).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { periodStart, periodEnd, payDate } = body;
  if (!periodStart || !periodEnd || !payDate) {
    return NextResponse.json({ error: "periodStart, periodEnd, payDate are required" }, { status: 400 });
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("pay_runs")
    .insert({ period_start: periodStart, period_end: periodEnd, pay_date: payDate, status: "draft" })
    .select()
    .single();
  if (runError || !run) return NextResponse.json({ error: runError?.message }, { status: 500 });

  const { data: employees } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("is_active", true)
    .neq("employee_type", "owner_draw");

  for (const emp of (employees || []) as Employee[]) {
    const computed = await computePaystub(emp, periodStart, periodEnd, payDate);
    await supabaseAdmin.from("paystubs").insert({
      pay_run_id: run.id,
      employee_id: computed.employeeId,
      regular_hours: computed.regularHours,
      overtime_hours: computed.overtimeHours,
      pto_hours_used: computed.ptoHoursUsed,
      gross_pay: computed.grossPay,
      pretax_401k: computed.pretax401k,
      pretax_section125: computed.pretaxSection125,
      federal_taxable_wages: computed.federalTaxableWages,
      federal_income_tax: computed.federalIncomeTax,
      social_security_employee: computed.socialSecurityEmployee,
      medicare_employee: computed.medicareEmployee,
      additional_medicare_employee: computed.additionalMedicareEmployee,
      social_security_employer: computed.socialSecurityEmployer,
      medicare_employer: computed.medicareEmployer,
      futa_employer: computed.futaEmployer,
      suta_employer: computed.sutaEmployer,
      posttax_deductions: computed.posttaxDeductions,
      net_pay: computed.netPay,
      ytd_gross: computed.ytdGross,
      ytd_federal_tax: computed.ytdFederalTax,
      ytd_ss_employee: computed.ytdSsEmployee,
      ytd_medicare_employee: computed.ytdMedicareEmployee,
      ytd_net: computed.ytdNet,
      ytd_pto_used: computed.ytdPtoUsed,
    });
  }

  return NextResponse.json({ run });
}
