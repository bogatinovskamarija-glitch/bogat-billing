// Pure schedule math for prepaid AREna contracts — no database access, so it
// is unit-testable and shared by the API and the one-off seeding script.

// Adds calendar months to a YYYY-MM-DD date, clamping to the end of the
// target month (Jan 31 + 1 month = Feb 28/29, never Mar 3). Always computed
// from the original start date rather than chained, so a clamp never drifts
// later installments.
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export interface ScheduleRow {
  periodNumber: number;
  recognitionDate: string;
  amount: number;
}

// One installment per service month, recognized on the day that month of
// service is completed (start + n months). Installments are whole cents; the
// last one absorbs any rounding remainder so they always sum to exactly the
// amount billed.
export function buildSchedule(startDate: string, termMonths: number, totalAmount: number): ScheduleRow[] {
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / termMonths);
  const rows: ScheduleRow[] = [];
  let allocated = 0;
  for (let n = 1; n <= termMonths; n++) {
    const cents = n === termMonths ? totalCents - allocated : baseCents;
    allocated += cents;
    rows.push({ periodNumber: n, recognitionDate: addMonths(startDate, n), amount: cents / 100 });
  }
  return rows;
}

// What this contract is worth per month for MRR purposes.
export function monthlyValue(totalAmount: number, termMonths: number): number {
  return Math.round((totalAmount / termMonths) * 100) / 100;
}
