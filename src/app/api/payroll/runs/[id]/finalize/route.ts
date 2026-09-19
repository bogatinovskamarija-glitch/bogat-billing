import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabase";
import { postJournalEntry } from "../../../../../../lib/ledger";

// Locks the run and posts one aggregated GL entry for it:
//   Dr Wages Expense (total gross) + Dr Payroll Tax Expense (employer share)
//   Cr Cash (total net paid out) + Cr Payroll Tax Payable (everything
//   withheld from employees plus the employer's own tax liability — lumped
//   into one payable rather than split into 401k/benefits/tax sub-accounts,
//   per the plan's "right level of detail" call).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const isTest = body?.isTest !== false; // defaults to test — real payroll is explicitly marked

  const { data: run, error: runError } = await supabaseAdmin.from("pay_runs").select("*").eq("id", params.id).single();
  if (runError || !run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  if (run.status === "finalized") return NextResponse.json({ error: "Already finalized" }, { status: 400 });

  const { data: paystubs } = await supabaseAdmin.from("paystubs").select("*").eq("pay_run_id", params.id);
  const stubs = paystubs || [];
  if (stubs.length === 0) return NextResponse.json({ error: "No paystubs on this run" }, { status: 400 });

  const totalGross = stubs.reduce((s, p) => s + Number(p.gross_pay), 0);
  const totalNet = stubs.reduce((s, p) => s + Number(p.net_pay), 0);
  const totalEmployerTax = stubs.reduce(
    (s, p) => s + Number(p.social_security_employer) + Number(p.medicare_employer) + Number(p.futa_employer) + Number(p.suta_employer),
    0
  );
  const totalPayable = Math.round((totalGross - totalNet + totalEmployerTax) * 100) / 100;

  const journalEntryId = await postJournalEntry(
    run.pay_date,
    `Payroll — ${run.period_start} to ${run.period_end}`,
    "payroll",
    run.id,
    [
      { accountCode: "5000", debit: Math.round(totalGross * 100) / 100, memo: "Gross wages" },
      { accountCode: "5100", debit: Math.round(totalEmployerTax * 100) / 100, memo: "Employer payroll taxes" },
      { accountCode: "1000", credit: Math.round(totalNet * 100) / 100, memo: "Net pay disbursed" },
      { accountCode: "2100", credit: totalPayable, memo: "Withheld + employer taxes owed" },
    ],
    isTest
  );

  await supabaseAdmin.from("pay_runs").update({ status: "finalized" }).eq("id", params.id);
  await supabaseAdmin.from("paystubs").update({ journal_entry_id: journalEntryId }).eq("pay_run_id", params.id);

  // PTO balance: accrue this period's allowance, subtract hours used.
  for (const stub of stubs) {
    const { data: employee } = await supabaseAdmin
      .from("employees")
      .select("pto_balance_hours, pto_accrual_hours_per_period")
      .eq("id", stub.employee_id)
      .single();
    if (employee) {
      const newBalance =
        Number(employee.pto_balance_hours) + Number(employee.pto_accrual_hours_per_period) - Number(stub.pto_hours_used);
      await supabaseAdmin.from("employees").update({ pto_balance_hours: newBalance }).eq("id", stub.employee_id);
    }
  }

  return NextResponse.json({ ok: true, journalEntryId });
}
