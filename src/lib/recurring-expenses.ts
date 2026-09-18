export interface RecurringCharge {
  vendor: string;
  occurrences: number;
  averageAmount: number;
  cadenceDays: number;
  lastDate: string;
  nextExpectedDate: string;
}

// Collapses a transaction description down to the part that identifies the
// vendor, stripping reference numbers so "SQ *COFFEE SHOP #4821" and
// "SQ *COFFEE SHOP #5190" group together instead of looking like two
// one-off charges.
function normalizeVendor(description: string): string {
  return description
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b\d{3,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

// Groups posted expenses by normalized vendor and flags groups that look
// like a subscription/recurring bill: 3+ occurrences, a consistent amount
// (±10%), on a roughly monthly cadence (20-40 day gaps). Pure read-side
// analysis over rows already in the `expenses` table — no new schema.
export function detectRecurringCharges(
  expenses: { expense_date: string; description: string; amount: number | string; status: string }[]
): RecurringCharge[] {
  const posted = expenses.filter((e) => e.status === "categorized");
  const groups = new Map<string, { expense_date: string; amount: number }[]>();
  for (const e of posted) {
    const key = normalizeVendor(e.description);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ expense_date: e.expense_date, amount: Number(e.amount) });
  }

  const charges: RecurringCharge[] = [];
  for (const [vendor, rows] of groups) {
    if (rows.length < 3) continue;
    const sorted = rows.slice().sort((a, b) => a.expense_date.localeCompare(b.expense_date));
    const avg = sorted.reduce((s, r) => s + r.amount, 0) / sorted.length;
    if (avg <= 0) continue;
    const consistent = sorted.every((r) => Math.abs(r.amount - avg) / avg <= 0.1);
    if (!consistent) continue;

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const days = (new Date(sorted[i].expense_date).getTime() - new Date(sorted[i - 1].expense_date).getTime()) / 86400000;
      gaps.push(days);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 20 || avgGap > 40) continue;

    const lastDate = sorted[sorted.length - 1].expense_date;
    const nextExpectedDate = new Date(new Date(lastDate + "T00:00:00").getTime() + avgGap * 86400000).toISOString().slice(0, 10);

    charges.push({
      vendor,
      occurrences: sorted.length,
      averageAmount: Math.round(avg * 100) / 100,
      cadenceDays: Math.round(avgGap),
      lastDate,
      nextExpectedDate,
    });
  }

  return charges.sort((a, b) => b.averageAmount - a.averageAmount);
}

export function recurringMonthlyTotal(charges: RecurringCharge[]): number {
  return Math.round(charges.reduce((s, c) => s + c.averageAmount, 0) * 100) / 100;
}
