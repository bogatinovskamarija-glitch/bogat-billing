import { describe, it, expect } from "vitest";
import { addMonths, buildSchedule, monthlyValue } from "./arena-schedule";

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(addMonths("2026-09-20", 1)).toBe("2026-10-20");
    expect(addMonths("2026-09-20", 6)).toBe("2027-03-20");
  });

  it("rolls over the year boundary", () => {
    expect(addMonths("2026-10-14", 3)).toBe("2027-01-14");
  });

  it("clamps to the end of a shorter month instead of spilling into the next", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("clamps from the original start, so a short month never drifts later installments", () => {
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
  });
});

describe("buildSchedule", () => {
  it("splits the real $239.94 / 6 month prepayment into six exact installments", () => {
    const rows = buildSchedule("2026-09-20", 6, 239.94);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.amount === 39.99)).toBe(true);
    expect(rows.map((r) => r.recognitionDate)).toEqual([
      "2026-10-20", "2026-11-20", "2026-12-20", "2027-01-20", "2027-02-20", "2027-03-20",
    ]);
  });

  it("always sums to exactly the amount billed, putting the rounding remainder in the last installment", () => {
    const rows = buildSchedule("2026-10-14", 3, 100);
    expect(rows.map((r) => r.amount)).toEqual([33.33, 33.33, 33.34]);
    const total = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    expect(total).toBe(100);
  });

  it("handles a single-installment contract", () => {
    expect(buildSchedule("2026-10-14", 1, 49.99)).toEqual([
      { periodNumber: 1, recognitionDate: "2026-11-14", amount: 49.99 },
    ]);
  });
});

describe("monthlyValue", () => {
  it("is the contract total divided by its term, in cents", () => {
    expect(monthlyValue(239.94, 6)).toBe(39.99);
    expect(monthlyValue(100, 3)).toBe(33.33);
  });
});
