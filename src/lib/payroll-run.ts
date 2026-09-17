import { supabaseAdmin } from "./supabase";
import { getUserTimeEntries, totalHours } from "./clickup";
import {
  calculateFederalWithholding,
  calculateFica,
  calculateEmployerTaxes,
  FilingStatus,
} from "./payroll-tax";

export type PayFrequency = "weekly" | "biweekly" | "semi_monthly" | "monthly";

// Explicit, not inferred from date length — a run's frequency is chosen up
// front (and matched against each employee's own pay_frequency), so this is
// deterministic even if the dates get nudged. This matters for correctness,
// not just convenience: the IRS percentage method annualizes taxable wages
// by periods-per-year, so getting this wrong overstates or understates
// annual income and mis-withholds.
const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semi_monthly: 24,
  monthly: 12,
};

export interface Employee {
  id: string;
  name: string;
  employee_type: "w2_hourly" | "w2_salary" | "1099" | "owner_draw";
  pay_frequency: PayFrequency;
  clickup_user_id: string | null;
  hourly_rate: number | null;
  annual_salary: number | null;
  filing_status: FilingStatus;
  step2_multiple_jobs: boolean;
  dependents_amount_annual: number;
  other_income_annual: number;
  deductions_annual: number;
  extra_withholding_per_period: number;
  pretax_401k_percent: number;
  pretax_section125_per_period: number;
  posttax_deductions_per_period: number;
  pto_accrual_hours_per_period: number;
  pto_balance_hours: number;
}

interface YtdTotals {
  ytdGross: number;
  ytdFicaWages: number;
  ytdFederalTax: number;
  ytdSsEmployee: number;
  ytdMedicareEmployee: number;
  ytdNet: number;
  ytdPtoUsed: number;
}

async function getYtdTotals(employeeId: string, beforeDate: string): Promise<YtdTotals> {
  const yearStart = `${beforeDate.slice(0, 4)}-01-01`;
  const { data } = await supabaseAdmin
    .from("paystubs")
    .select("gross_pay, pretax_section125, federal_income_tax, social_security_employee, medicare_employee, net_pay, pto_hours_used, pay_runs!inner(status, pay_date)")
    .eq("employee_id", employeeId)
    .eq("pay_runs.status", "finalized")
    .gte("pay_runs.pay_date", yearStart)
    .lt("pay_runs.pay_date", beforeDate);

  const rows = data || [];
  return {
    ytdGross: rows.reduce((s: number, r: any) => s + Number(r.gross_pay), 0),
    ytdFicaWages: rows.reduce((s: number, r: any) => s + Number(r.gross_pay) - Number(r.pretax_section125), 0),
    ytdFederalTax: rows.reduce((s: number, r: any) => s + Number(r.federal_income_tax), 0),
    ytdSsEmployee: rows.reduce((s: number, r: any) => s + Number(r.social_security_employee), 0),
    ytdMedicareEmployee: rows.reduce((s: number, r: any) => s + Number(r.medicare_employee), 0),
    ytdNet: rows.reduce((s: number, r: any) => s + Number(r.net_pay), 0),
    ytdPtoUsed: rows.reduce((s: number, r: any) => s + Number(r.pto_hours_used), 0),
  };
}

export interface ComputedPaystub {
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  ptoHoursUsed: number;
  grossPay: number;
  pretax401k: number;
  pretaxSection125: number;
  federalTaxableWages: number;
  federalIncomeTax: number;
  socialSecurityEmployee: number;
  medicareEmployee: number;
  additionalMedicareEmployee: number;
  socialSecurityEmployer: number;
  medicareEmployer: number;
  futaEmployer: number;
  sutaEmployer: number;
  posttaxDeductions: number;
  netPay: number;
  ytdGross: number;
  ytdFederalTax: number;
  ytdSsEmployee: number;
  ytdMedicareEmployee: number;
  ytdNet: number;
  ytdPtoUsed: number;
}

// Splits ClickUp time entries into regular vs. overtime by ISO week (>40
// hours worked in a calendar week is overtime, per FLSA) rather than just
// totaling the whole pay period, which would misclassify OT in a period
// that spans two light weeks each under 40.
async function getRegularAndOvertimeHours(clickupUserId: string, periodStart: string, periodEnd: string) {
  const startMs = new Date(periodStart + "T00:00:00").getTime();
  const endMs = new Date(periodEnd + "T23:59:59").getTime();
  const entries = await getUserTimeEntries(clickupUserId, startMs, endMs);

  const byWeek = new Map<string, number>();
  entries.forEach((e) => {
    const d = new Date(Number(e.start));
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    byWeek.set(key, (byWeek.get(key) || 0) + parseInt(e.duration, 10) / 3600000);
  });

  let regular = 0;
  let overtime = 0;
  byWeek.forEach((hours) => {
    regular += Math.min(hours, 40);
    overtime += Math.max(0, hours - 40);
  });

  return { regular: Math.round(regular * 100) / 100, overtime: Math.round(overtime * 100) / 100 };
}

export async function computePaystub(
  employee: Employee,
  periodStart: string,
  periodEnd: string,
  payDate: string,
  payFrequency: PayFrequency,
  options: { ptoHoursUsed?: number; manualGrossOverride?: number } = {}
): Promise<ComputedPaystub> {
  const ytd = await getYtdTotals(employee.id, payDate);
  const ptoHoursUsed = options.ptoHoursUsed ?? 0;
  const periodsPerYear = PERIODS_PER_YEAR[payFrequency];

  let regularHours = 0;
  let overtimeHours = 0;
  let grossPay = 0;

  if (employee.employee_type === "w2_hourly") {
    const rate = employee.hourly_rate ?? 0;
    if (employee.clickup_user_id) {
      const hours = await getRegularAndOvertimeHours(employee.clickup_user_id, periodStart, periodEnd);
      regularHours = hours.regular;
      overtimeHours = hours.overtime;
    }
    grossPay = regularHours * rate + overtimeHours * rate * 1.5 + ptoHoursUsed * rate;
  } else if (employee.employee_type === "w2_salary") {
    grossPay = (employee.annual_salary ?? 0) / periodsPerYear;
  } else if (employee.employee_type === "1099") {
    grossPay = options.manualGrossOverride ?? 0;
  }
  // owner_draw doesn't go through this function at all — see the separate
  // "Record Owner's Draw" action.

  grossPay = Math.round(grossPay * 100) / 100;

  if (employee.employee_type === "1099") {
    // Contractors handle their own taxes — no withholding, no employer match.
    return {
      employeeId: employee.id,
      regularHours,
      overtimeHours,
      ptoHoursUsed: 0,
      grossPay,
      pretax401k: 0,
      pretaxSection125: 0,
      federalTaxableWages: grossPay,
      federalIncomeTax: 0,
      socialSecurityEmployee: 0,
      medicareEmployee: 0,
      additionalMedicareEmployee: 0,
      socialSecurityEmployer: 0,
      medicareEmployer: 0,
      futaEmployer: 0,
      sutaEmployer: 0,
      posttaxDeductions: 0,
      netPay: grossPay,
      ytdGross: ytd.ytdGross + grossPay,
      ytdFederalTax: ytd.ytdFederalTax,
      ytdSsEmployee: ytd.ytdSsEmployee,
      ytdMedicareEmployee: ytd.ytdMedicareEmployee,
      ytdNet: ytd.ytdNet + grossPay,
      ytdPtoUsed: ytd.ytdPtoUsed,
    };
  }

  const pretax401k = Math.round(grossPay * (employee.pretax_401k_percent / 100) * 100) / 100;
  const pretaxSection125 = employee.pretax_section125_per_period;
  const federalTaxableWages = Math.max(0, grossPay - pretax401k - pretaxSection125);
  const ficaWagesThisPeriod = Math.max(0, grossPay - pretaxSection125);

  const federalIncomeTax = calculateFederalWithholding({
    taxableWagesThisPeriod: federalTaxableWages,
    filingStatus: employee.filing_status,
    dependentsAmountAnnual: employee.dependents_amount_annual,
    otherIncomeAnnual: employee.other_income_annual,
    deductionsAnnual: employee.deductions_annual,
    extraWithholdingPerPeriod: employee.extra_withholding_per_period,
    periodsPerYear,
  });

  const fica = calculateFica(ficaWagesThisPeriod, ytd.ytdFicaWages);
  const employerTaxes = calculateEmployerTaxes(grossPay, ytd.ytdGross);

  const posttaxDeductions = employee.posttax_deductions_per_period;
  const netPay =
    Math.round(
      (grossPay -
        pretax401k -
        pretaxSection125 -
        federalIncomeTax -
        fica.socialSecurityEmployee -
        fica.medicareEmployee -
        fica.additionalMedicareEmployee -
        posttaxDeductions) *
        100
    ) / 100;

  return {
    employeeId: employee.id,
    regularHours,
    overtimeHours,
    ptoHoursUsed,
    grossPay,
    pretax401k,
    pretaxSection125,
    federalTaxableWages,
    federalIncomeTax,
    socialSecurityEmployee: fica.socialSecurityEmployee,
    medicareEmployee: fica.medicareEmployee,
    additionalMedicareEmployee: fica.additionalMedicareEmployee,
    socialSecurityEmployer: fica.socialSecurityEmployer,
    medicareEmployer: fica.medicareEmployer,
    futaEmployer: employerTaxes.futaEmployer,
    sutaEmployer: employerTaxes.sutaEmployer,
    posttaxDeductions,
    netPay,
    ytdGross: ytd.ytdGross + grossPay,
    ytdFederalTax: ytd.ytdFederalTax + federalIncomeTax,
    ytdSsEmployee: ytd.ytdSsEmployee + fica.socialSecurityEmployee,
    ytdMedicareEmployee: ytd.ytdMedicareEmployee + fica.medicareEmployee,
    ytdNet: ytd.ytdNet + netPay,
    ytdPtoUsed: ytd.ytdPtoUsed + ptoHoursUsed,
  };
}
