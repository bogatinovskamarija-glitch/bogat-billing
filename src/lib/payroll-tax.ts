// Payroll tax engine — 2026 figures, sourced from IRS Publication 15-T
// (2026 Percentage Method Tables for Automated Payroll Systems, Standard
// Withholding / Step 2 not checked), the SSA's 2026 wage base announcement,
// and the Florida Department of Revenue's reemployment tax page.
//
// IMPORTANT: verify these against the current year's published tables
// before relying on this for real filings — this is a payroll calculator,
// not a substitute for a CPA. Update FEDERAL_BRACKETS and the constants
// below whenever the IRS/SSA/FL DOR publish new figures (typically each
// November/December for the following year).

export type FilingStatus = "single" | "married_jointly" | "head_of_household";

interface Bracket {
  upTo: number; // exclusive upper bound, Infinity for the top bracket
  base: number;
  rate: number;
  over: number;
}

// 2026 Standard Withholding Rate Schedules (annual), Form W-4 2020+, Step 2 NOT checked.
const FEDERAL_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 7500, base: 0, rate: 0, over: 0 },
    { upTo: 19900, base: 0, rate: 0.1, over: 7500 },
    { upTo: 57900, base: 1240, rate: 0.12, over: 19900 },
    { upTo: 113200, base: 5800, rate: 0.22, over: 57900 },
    { upTo: 209275, base: 17966, rate: 0.24, over: 113200 },
    { upTo: 263725, base: 41024, rate: 0.32, over: 209275 },
    { upTo: 648100, base: 58448, rate: 0.35, over: 263725 },
    { upTo: Infinity, base: 192979, rate: 0.37, over: 648100 },
  ],
  married_jointly: [
    { upTo: 19300, base: 0, rate: 0, over: 0 },
    { upTo: 44100, base: 0, rate: 0.1, over: 19300 },
    { upTo: 120100, base: 2480, rate: 0.12, over: 44100 },
    { upTo: 230700, base: 11600, rate: 0.22, over: 120100 },
    { upTo: 422850, base: 35932, rate: 0.24, over: 230700 },
    { upTo: 531750, base: 82048, rate: 0.32, over: 422850 },
    { upTo: 788000, base: 116896, rate: 0.35, over: 531750 },
    { upTo: Infinity, base: 206584, rate: 0.37, over: 788000 },
  ],
  head_of_household: [
    { upTo: 15550, base: 0, rate: 0, over: 0 },
    { upTo: 33250, base: 0, rate: 0.1, over: 15550 },
    { upTo: 83000, base: 1770, rate: 0.12, over: 33250 },
    { upTo: 121250, base: 7740, rate: 0.22, over: 83000 },
    { upTo: 217300, base: 16155, rate: 0.24, over: 121250 },
    { upTo: 271750, base: 39207, rate: 0.32, over: 217300 },
    { upTo: 656150, base: 56631, rate: 0.35, over: 271750 },
    { upTo: Infinity, base: 191171, rate: 0.37, over: 656150 },
  ],
};

export const SOCIAL_SECURITY_WAGE_BASE_2026 = 184500;
export const SOCIAL_SECURITY_RATE = 0.062;
export const MEDICARE_RATE = 0.0145;
export const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
export const ADDITIONAL_MEDICARE_RATE = 0.009;
export const FUTA_WAGE_BASE = 7000;
export const FUTA_EFFECTIVE_RATE = 0.006; // 6.0% - 5.4% timely-SUTA credit (FL is not a credit-reduction state)
export const FL_SUTA_WAGE_BASE = 7000;
export const FL_SUTA_NEW_EMPLOYER_RATE = 0.027;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function annualFederalTax(adjustedAnnualWage: number, filingStatus: FilingStatus): number {
  const brackets = FEDERAL_BRACKETS[filingStatus];
  const bracket = brackets.find((b) => adjustedAnnualWage < b.upTo) ?? brackets[brackets.length - 1];
  return Math.max(0, bracket.base + (adjustedAnnualWage - bracket.over) * bracket.rate);
}

export interface WithholdingInput {
  taxableWagesThisPeriod: number; // gross minus pre-tax deductions (401k + Section 125)
  filingStatus: FilingStatus;
  dependentsAmountAnnual: number; // W-4 Step 3
  otherIncomeAnnual: number; // W-4 Step 4(a)
  deductionsAnnual: number; // W-4 Step 4(b)
  extraWithholdingPerPeriod: number; // W-4 Step 4(c)
  periodsPerYear: number; // 24 for semi-monthly
}

// IRS Percentage Method (Worksheet 1B): annualize -> apply bracket table ->
// subtract the annual dependents credit -> divide back to one period -> add
// Step 4(c) extra withholding.
export function calculateFederalWithholding(input: WithholdingInput): number {
  const adjustedAnnualWage = Math.max(
    0,
    input.taxableWagesThisPeriod * input.periodsPerYear + input.otherIncomeAnnual - input.deductionsAnnual
  );
  const tentativeAnnualTax = annualFederalTax(adjustedAnnualWage, input.filingStatus);
  const annualTaxAfterCredits = Math.max(0, tentativeAnnualTax - input.dependentsAmountAnnual);
  const perPeriod = annualTaxAfterCredits / input.periodsPerYear;
  return round2(perPeriod + input.extraWithholdingPerPeriod);
}

export interface FicaResult {
  socialSecurityEmployee: number;
  medicareEmployee: number;
  additionalMedicareEmployee: number;
  socialSecurityEmployer: number;
  medicareEmployer: number;
}

// `ficaWagesThisPeriod` = gross minus Section 125 pre-tax deductions only —
// 401(k) deferrals are still FICA-taxable, unlike federal income tax.
// `ytdFicaWagesBefore` = sum of that same figure across the employee's
// prior paystubs this calendar year, for wage-base capping.
export function calculateFica(ficaWagesThisPeriod: number, ytdFicaWagesBefore: number): FicaResult {
  const ssRemainingRoom = Math.max(0, SOCIAL_SECURITY_WAGE_BASE_2026 - ytdFicaWagesBefore);
  const ssTaxable = Math.min(ficaWagesThisPeriod, ssRemainingRoom);

  const ytdAfter = ytdFicaWagesBefore + ficaWagesThisPeriod;
  const amountOverThreshold = Math.max(0, ytdAfter - ADDITIONAL_MEDICARE_THRESHOLD);
  const thisPeriodOverThreshold = Math.min(ficaWagesThisPeriod, amountOverThreshold);

  return {
    socialSecurityEmployee: round2(ssTaxable * SOCIAL_SECURITY_RATE),
    medicareEmployee: round2(ficaWagesThisPeriod * MEDICARE_RATE),
    additionalMedicareEmployee: round2(thisPeriodOverThreshold * ADDITIONAL_MEDICARE_RATE),
    socialSecurityEmployer: round2(ssTaxable * SOCIAL_SECURITY_RATE),
    medicareEmployer: round2(ficaWagesThisPeriod * MEDICARE_RATE),
  };
}

export interface EmployerTaxResult {
  futaEmployer: number;
  sutaEmployer: number;
}

// Employer-only costs — never withheld from the employee. Tracked for
// Maria's own books and to make quarterly 940/RT-6 prep easier, not filed
// automatically.
export function calculateEmployerTaxes(grossWagesThisPeriod: number, ytdGrossBefore: number): EmployerTaxResult {
  const futaRoom = Math.max(0, FUTA_WAGE_BASE - ytdGrossBefore);
  const futaTaxable = Math.min(grossWagesThisPeriod, futaRoom);
  const sutaRoom = Math.max(0, FL_SUTA_WAGE_BASE - ytdGrossBefore);
  const sutaTaxable = Math.min(grossWagesThisPeriod, sutaRoom);

  return {
    futaEmployer: round2(futaTaxable * FUTA_EFFECTIVE_RATE),
    sutaEmployer: round2(sutaTaxable * FL_SUTA_NEW_EMPLOYER_RATE),
  };
}
