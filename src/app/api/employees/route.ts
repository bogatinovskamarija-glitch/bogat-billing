import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export async function GET() {
  const { data, error } = await supabaseAdmin.from("employees").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.name || !body?.employeeType) {
    return NextResponse.json({ error: "name and employeeType are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("employees")
    .insert({
      name: body.name,
      email: body.email ?? null,
      role_title: body.roleTitle ?? null,
      employee_type: body.employeeType,
      pay_frequency: body.payFrequency ?? "weekly",
      clickup_user_id: body.clickupUserId ?? null,
      hourly_rate: body.hourlyRate ?? null,
      billing_rate: body.billingRate ?? null,
      annual_salary: body.annualSalary ?? null,
      filing_status: body.filingStatus ?? "single",
      step2_multiple_jobs: body.step2MultipleJobs ?? false,
      dependents_amount_annual: body.dependentsAmountAnnual ?? 0,
      other_income_annual: body.otherIncomeAnnual ?? 0,
      deductions_annual: body.deductionsAnnual ?? 0,
      extra_withholding_per_period: body.extraWithholdingPerPeriod ?? 0,
      pretax_401k_percent: body.pretax401kPercent ?? 0,
      pretax_section125_per_period: body.pretaxSection125PerPeriod ?? 0,
      posttax_deductions_per_period: body.posttaxDeductionsPerPeriod ?? 0,
      pto_accrual_hours_per_period: body.ptoAccrualHoursPerPeriod ?? 0,
      pto_balance_hours: body.ptoBalanceHours ?? 0,
      state: body.state ?? "FL",
      hire_date: body.hireDate ?? null,
      mailing_address: body.mailingAddress ?? null,
      bank_name: body.bankName ?? null,
      bank_account_last4: body.bankAccountLast4 ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employee: data });
}
