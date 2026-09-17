import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const FIELD_MAP: Record<string, string> = {
  name: "name",
  email: "email",
  roleTitle: "role_title",
  employeeType: "employee_type",
  payFrequency: "pay_frequency",
  clickupUserId: "clickup_user_id",
  hourlyRate: "hourly_rate",
  billingRate: "billing_rate",
  annualSalary: "annual_salary",
  filingStatus: "filing_status",
  step2MultipleJobs: "step2_multiple_jobs",
  dependentsAmountAnnual: "dependents_amount_annual",
  otherIncomeAnnual: "other_income_annual",
  deductionsAnnual: "deductions_annual",
  extraWithholdingPerPeriod: "extra_withholding_per_period",
  pretax401kPercent: "pretax_401k_percent",
  pretaxSection125PerPeriod: "pretax_section125_per_period",
  posttaxDeductionsPerPeriod: "posttax_deductions_per_period",
  ptoAccrualHoursPerPeriod: "pto_accrual_hours_per_period",
  ptoBalanceHours: "pto_balance_hours",
  state: "state",
  isActive: "is_active",
  hireDate: "hire_date",
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (body[key] !== undefined) patch[column] = body[key];
  }

  const { data, error } = await supabaseAdmin.from("employees").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}
