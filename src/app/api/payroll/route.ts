import { NextRequest, NextResponse } from "next/server";
import { getUserTimeEntries, totalHours, billableHours } from "@/lib/clickup";

// Solo scope for now (see plan): one row, Maria's real tracked hours.
// Salaried — no invented gross figure, per the design spec's explicit rule.
const MARIA_CLICKUP_USER_ID = "57266783";

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end query params are required (YYYY-MM-DD)" }, { status: 400 });
  }

  const startMs = new Date(start + "T00:00:00").getTime();
  const endMs = new Date(end + "T23:59:59").getTime();

  const entries = await getUserTimeEntries(MARIA_CLICKUP_USER_ID, startMs, endMs);
  const regular = totalHours(entries);
  const billable = billableHours(entries);

  return NextResponse.json({
    people: [
      {
        name: "Maria Bogat",
        role: "Principal",
        basis: "Salaried",
        regularHours: regular,
        billableHours: billable,
        gross: null, // salaried — dash, never an invented figure
      },
    ],
  });
}
