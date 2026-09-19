import { describe, it, expect } from "vitest";
import { suggestAccountCode } from "./expense-categorizer";

describe("suggestAccountCode — outflow (direction: out)", () => {
  it("matches a known vendor keyword", () => {
    expect(suggestAccountCode("GOOGLE *CLOUD DwB3Jx", "out")).toBe("6000");
  });

  it("falls back to Other Expense for an unrecognized vendor", () => {
    expect(suggestAccountCode("SOME RANDOM VENDOR XYZ", "out")).toBe("6900");
  });

  it("matches a Zelle-out payment to Member Draws", () => {
    expect(suggestAccountCode("Zelle payment to Maria Bogatinovska JPM99b4y1n1u", "out")).toBe("3100");
  });

  it("defaults to out when no direction is passed", () => {
    expect(suggestAccountCode("AMAZON MKTPL*XW7BQ3I")).toBe("6410");
  });
});

describe("suggestAccountCode — inflow (direction: in)", () => {
  it("matches a Zelle-in payment to Member Equity (contribution)", () => {
    expect(suggestAccountCode("Zelle payment from MARIJA BOGATINOVSKA BACs44a9oiu1", "in")).toBe("3000");
  });

  it("matches Upwork income", () => {
    expect(suggestAccountCode("UPWORK MOUNTAIN VIEW CA 751983 01/30", "in")).toBe("4200");
  });

  it("routes a refund of a known expense vendor back to that same expense account", () => {
    // The real case that was mis-imported: a positive-amount Autodesk row
    // sharing a description with the original expense charges. Crediting
    // the same Software & Subscriptions account it would have debited is
    // the correct contra-expense treatment.
    expect(suggestAccountCode("Autodesk ADY 855-3019562 CA 01/17", "in")).toBe("6000");
  });

  it("falls back to Other Income, not Other Expense, for an unrecognized inflow", () => {
    expect(suggestAccountCode("SOME UNKNOWN DEPOSIT", "in")).toBe("4900");
  });
});
