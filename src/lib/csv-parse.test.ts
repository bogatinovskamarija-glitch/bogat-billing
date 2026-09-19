import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv-parse";

describe("parseCsv", () => {
  it("parses a simple CSV with headers", () => {
    const { headers, rows } = parseCsv("Date,Description,Amount\n1/1/2025,Coffee,-5.00\n");
    expect(headers).toEqual(["Date", "Description", "Amount"]);
    expect(rows).toEqual([["1/1/2025", "Coffee", "-5.00"]]);
  });

  it("handles a quoted field containing a comma", () => {
    const { rows } = parseCsv('Date,Description,Amount\n1/1/2025,"Zelle payment from X, Y",100\n');
    expect(rows[0][1]).toBe("Zelle payment from X, Y");
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const { rows } = parseCsv('Date,Description,Amount\n1/1/2025,"EDDIE V""S RESTAURANT",-50\n');
    expect(rows[0][1]).toBe('EDDIE V"S RESTAURANT');
  });

  it("normalizes CRLF line endings", () => {
    const { rows } = parseCsv("Date,Amount\r\n1/1/2025,10\r\n1/2/2025,20\r\n");
    expect(rows).toHaveLength(2);
  });

  it("drops blank lines", () => {
    const { rows } = parseCsv("Date,Amount\n1/1/2025,10\n\n1/2/2025,20\n");
    expect(rows).toHaveLength(2);
  });
});
