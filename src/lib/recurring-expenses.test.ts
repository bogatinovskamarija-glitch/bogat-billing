import { describe, it, expect } from "vitest";
import { detectRecurringCharges, recurringMonthlyTotal } from "./recurring-expenses";

function categorized(date: string, description: string, amount: number) {
  return { expense_date: date, description, amount, status: "categorized" };
}

describe("detectRecurringCharges", () => {
  it("flags a vendor charged 3+ times at a consistent amount on a ~monthly cadence", () => {
    const charges = detectRecurringCharges([
      categorized("2025-01-20", "TOGGL.COM TOGGL.COM DE 01/20", 10),
      categorized("2025-02-20", "TOGGL.COM TOGGL.COM DE 02/20", 10),
      categorized("2025-03-20", "TOGGL.COM TOGGL.COM DE 03/20", 10),
    ]);
    expect(charges).toHaveLength(1);
    expect(charges[0].averageAmount).toBe(10);
    expect(charges[0].occurrences).toBe(3);
  });

  it("does not flag a vendor seen fewer than 3 times", () => {
    const charges = detectRecurringCharges([
      categorized("2025-01-20", "TOGGL.COM TOGGL.COM DE 01/20", 10),
      categorized("2025-02-20", "TOGGL.COM TOGGL.COM DE 02/20", 10),
    ]);
    expect(charges).toHaveLength(0);
  });

  it("does not flag amounts that vary by more than 10%", () => {
    const charges = detectRecurringCharges([
      categorized("2025-01-20", "SOME VENDOR", 10),
      categorized("2025-02-20", "SOME VENDOR", 25),
      categorized("2025-03-20", "SOME VENDOR", 8),
    ]);
    expect(charges).toHaveLength(0);
  });

  it("does not flag a cadence outside the 20-40 day window", () => {
    const charges = detectRecurringCharges([
      categorized("2025-01-01", "SOME VENDOR", 10),
      categorized("2025-01-05", "SOME VENDOR", 10),
      categorized("2025-01-09", "SOME VENDOR", 10),
    ]);
    expect(charges).toHaveLength(0);
  });

  it("ignores uncategorized (pending) rows", () => {
    const charges = detectRecurringCharges([
      { expense_date: "2025-01-20", description: "TOGGL.COM", amount: 10, status: "uncategorized" },
      { expense_date: "2025-02-20", description: "TOGGL.COM", amount: 10, status: "uncategorized" },
      { expense_date: "2025-03-20", description: "TOGGL.COM", amount: 10, status: "uncategorized" },
    ]);
    expect(charges).toHaveLength(0);
  });
});

describe("recurringMonthlyTotal", () => {
  it("sums the average amounts across all detected charges", () => {
    const total = recurringMonthlyTotal([
      { vendor: "A", occurrences: 3, averageAmount: 10, cadenceDays: 30, lastDate: "2025-03-01", nextExpectedDate: "2025-04-01" },
      { vendor: "B", occurrences: 3, averageAmount: 25.5, cadenceDays: 30, lastDate: "2025-03-01", nextExpectedDate: "2025-04-01" },
    ]);
    expect(total).toBe(35.5);
  });
});
