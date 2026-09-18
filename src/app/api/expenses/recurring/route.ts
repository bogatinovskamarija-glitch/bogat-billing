import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase";
import { detectRecurringCharges, recurringMonthlyTotal } from "../../../../lib/recurring-expenses";

// Shared by the Expenses page's "Recurring charges" panel and the Budget
// page's monthly reference figure, so the detection logic lives in one place.
export async function GET() {
  const { data: expenses } = await supabaseAdmin.from("expenses").select("expense_date, description, amount, status");
  const charges = detectRecurringCharges(expenses || []);
  return NextResponse.json({ charges, monthlyTotal: recurringMonthlyTotal(charges) });
}
