import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv-parse";

// Chase's checking-account export — auto-detected so the common case needs
// no manual mapping. Anything else falls back to the flexible mapper.
function detectChaseMapping(headers: string[]): Record<string, string> | null {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const has = (name: string) => norm.includes(name);
  if (has("details") && has("posting date") && has("description") && has("amount")) {
    return {
      dateCol: headers[norm.indexOf("posting date")],
      descCol: headers[norm.indexOf("description")],
      amountCol: headers[norm.indexOf("amount")],
      detailsCol: headers[norm.indexOf("details")],
    };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { csvText } = await req.json();
  if (!csvText) return NextResponse.json({ error: "csvText is required" }, { status: 400 });

  const { headers, rows } = parseCsv(csvText);
  const detectedMapping = detectChaseMapping(headers);

  return NextResponse.json({
    headers,
    previewRows: rows.slice(0, 8),
    rowCount: rows.length,
    detectedMapping,
    detectedFormat: detectedMapping ? "chase" : null,
  });
}
