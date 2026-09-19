import { describe, it, expect } from "vitest";
import { checkBalanced } from "./ledger";

describe("checkBalanced", () => {
  it("accepts a balanced two-line entry", () => {
    const result = checkBalanced([
      { accountCode: "6000", debit: 100 },
      { accountCode: "1000", credit: 100 },
    ]);
    expect(result.balanced).toBe(true);
    expect(result.totalDebit).toBe(100);
    expect(result.totalCredit).toBe(100);
  });

  it("accepts a balanced multi-line entry (payroll-style)", () => {
    const result = checkBalanced([
      { accountCode: "5000", debit: 2715.0 },
      { accountCode: "5100", debit: 297.29 },
      { accountCode: "1000", credit: 2032.66 },
      { accountCode: "2100", credit: 979.63 },
    ]);
    expect(result.balanced).toBe(true);
  });

  it("rejects an unbalanced entry", () => {
    const result = checkBalanced([
      { accountCode: "6000", debit: 100 },
      { accountCode: "1000", credit: 99.99 },
    ]);
    expect(result.balanced).toBe(false);
  });

  it("is not fooled by floating-point rounding noise", () => {
    // 0.1 + 0.2 !== 0.3 in raw IEEE754 — the cents rounding must absorb this.
    const result = checkBalanced([
      { accountCode: "6000", debit: 0.1 },
      { accountCode: "6000", debit: 0.2 },
      { accountCode: "1000", credit: 0.3 },
    ]);
    expect(result.balanced).toBe(true);
  });

  it("treats an entry with only debits (missing credit leg) as unbalanced", () => {
    const result = checkBalanced([{ accountCode: "6000", debit: 50 }]);
    expect(result.balanced).toBe(false);
    expect(result.totalCredit).toBe(0);
  });
});
