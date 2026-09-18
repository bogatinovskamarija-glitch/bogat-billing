import { NextResponse } from "next/server";
import { getDeals } from "../../../lib/pipeline";

export type { Stage, Deal } from "../../../lib/pipeline";

export async function GET() {
  const deals = await getDeals();
  return NextResponse.json({ deals });
}
