import { describe, it, expect } from "vitest";
import { parseImportDate, directionFromAmount, dedupeKey } from "./expense-import";

describe("directionFromAmount", () => {
  it("treats a negative amount as money out", () => {
    expect(directionFromAmount(-48.0)).toBe("out");
  });

  it("treats a positive amount as money in — including refunds, regardless of category", () => {
    // This is the exact real-world case that got mis-imported the first
    // time: an Autodesk charge refunded at +336, sharing a description
    // with the original -336/-365 charges. Direction must come from the
    // sign alone, never from what the transaction "looks like."
    expect(directionFromAmount(336.0)).toBe("in");
  });

  it("never trusts a bank's own DEBIT/CREDIT label — sign is the only input", () => {
    // The bug this guards: 5 real rows in the source data were labeled
    // "DEBIT" by the bank but carried a positive amount. directionFromAmount
    // takes no label as input at all, so there is nothing for it to trust
    // incorrectly.
    expect(directionFromAmount(68.29)).toBe("in");
  });

  it("treats zero as money in (never negative)", () => {
    expect(directionFromAmount(0)).toBe("in");
  });
});

describe("parseImportDate", () => {
  it("parses Chase-style M/D/YYYY", () => {
    expect(parseImportDate("1/21/2025")).toBe("2025-01-21");
  });

  it("parses M/D/YYYY with two-digit month/day", () => {
    expect(parseImportDate("12/16/2024")).toBe("2024-12-16");
  });

  it("passes through an already-ISO date", () => {
    expect(parseImportDate("2025-06-15")).toBe("2025-06-15");
  });

  it("returns null for garbage input", () => {
    expect(parseImportDate("not a date")).toBeNull();
  });
});

describe("dedupeKey", () => {
  it("produces the same key for the same transaction re-imported", () => {
    const a = dedupeKey("2025-01-21", "Autodesk ADY 855-3019562 CA 01/17", 336);
    const b = dedupeKey("2025-01-21", "Autodesk ADY 855-3019562 CA 01/17", 336);
    expect(a).toBe(b);
  });

  it("distinguishes rows differing only by amount", () => {
    const a = dedupeKey("2025-01-21", "SIGN.COM ZURICH", 10);
    const b = dedupeKey("2025-01-21", "SIGN.COM ZURICH", 10.01);
    expect(a).not.toBe(b);
  });

  it("distinguishes rows differing only by date", () => {
    const a = dedupeKey("2025-01-21", "MONTHLY SERVICE FEE", 15);
    const b = dedupeKey("2025-02-21", "MONTHLY SERVICE FEE", 15);
    expect(a).not.toBe(b);
  });
});
