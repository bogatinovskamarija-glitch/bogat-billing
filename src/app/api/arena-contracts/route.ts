import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { createPrepaidContract } from "../../../lib/arena-contracts";

export async function GET() {
  const [{ data: contracts, error }, { data: summary }] = await Promise.all([
    supabaseAdmin
      .from("arena_subscriptions")
      .select("*, arena_subscription_schedule(period_number, recognition_date, amount)")
      .eq("is_test", false)
      .order("contract_start", { ascending: false }),
    supabaseAdmin.from("kpi_summary").select("*").single(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: contracts || [], summary: summary || null });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const result = await createPrepaidContract({
      subscriberName: body.subscriberName,
      startDate: body.startDate,
      termMonths: Number(body.termMonths),
      totalAmount: Number(body.totalAmount),
      processingFee: body.processingFee ? Number(body.processingFee) : 0,
      stripeInvoiceId: body.stripeInvoiceId || undefined,
      stripeCustomerId: body.stripeCustomerId || undefined,
      notes: body.notes || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create contract" }, { status: 400 });
  }
}
