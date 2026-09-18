import { NextRequest, NextResponse } from "next/server";
import { getEmployeePerformance } from "../../../../lib/employee-performance";

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ error: "start and end are required" }, { status: 400 });

  const performance = await getEmployeePerformance(start, end);
  return NextResponse.json({ performance });
}
