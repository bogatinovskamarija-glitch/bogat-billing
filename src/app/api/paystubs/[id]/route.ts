import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computePaystub, Employee } from "@/lib/payroll-run";

// Recomputes one paystub (e.g. after editing PTO hours or a 1099 contractor's
// manual gross amount) — only while its run is still a draft.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();

  const { data: stub, error: stubError } = await supabaseAdmin
    .from("paystubs")
    .select("*, pay_runs(id, period_start, period_end, pay_date, status)")
    .eq("id", params.id)
    .single();
  if (stubError || !stub) return NextResponse.json({ error: "Paystub not found" }, { status: 404 });
  if (stub.pay_runs.status !== "draft") {
    return NextResponse.json({ error: "Run is already finalized" }, { status: 400 });
  }

  const { data: employee } = await supabaseAdmin.from("employees").select("*").eq("id", stub.employee_id).single();
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const computed = await computePaystub(
    employee as Employee,
    stub.pay_runs.period_start,
    stub.pay_runs.period_end,
    stub.pay_runs.pay_date,
    { ptoHoursUsed: body.ptoHoursUsed, manualGrossOverride: body.manualGrossOverride }
  );

  const { data: updated, error } = await supabaseAdmin
    .from("paystubs")
    .update({
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
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paystub: updated });
}
