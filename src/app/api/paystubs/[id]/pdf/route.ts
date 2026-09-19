import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "../../../../../lib/supabase";
import PaystubDocument, { PaystubPdfData } from "../../../../../pdf/PaystubDocument";

export const runtime = "nodejs";

export async function GET(_req: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const { data: stub, error } = await supabaseAdmin
    .from("paystubs")
    .select("*, employees(name, role_title, employee_type, hourly_rate, annual_salary, bank_name), pay_runs(period_start, period_end, pay_date)")
    .eq("id", params.id)
    .single();
  if (error || !stub) return NextResponse.json({ error: "Paystub not found" }, { status: 404 });

  const data: PaystubPdfData = {
    employeeName: stub.employees?.name ?? "—",
    roleTitle: stub.employees?.role_title ?? null,
    employeeAddress: stub.employee_address ?? null,
    hourlyRate: stub.employees?.employee_type === "w2_hourly" ? Number(stub.employees.hourly_rate) || null : null,
    bankName: stub.employees?.bank_name ?? null,
    bankAccountLast4: stub.bank_account_last4 ?? null,
    periodStart: stub.pay_runs.period_start,
    periodEnd: stub.pay_runs.period_end,
    payDate: stub.pay_runs.pay_date,
    regularHours: Number(stub.regular_hours),
    overtimeHours: Number(stub.overtime_hours),
    ptoHoursUsed: Number(stub.pto_hours_used),
    grossPay: Number(stub.gross_pay),
    pretax401k: Number(stub.pretax_401k),
    pretaxSection125: Number(stub.pretax_section125),
    federalIncomeTax: Number(stub.federal_income_tax),
    socialSecurityEmployee: Number(stub.social_security_employee),
    medicareEmployee: Number(stub.medicare_employee),
    additionalMedicareEmployee: Number(stub.additional_medicare_employee),
    posttaxDeductions: Number(stub.posttax_deductions),
    netPay: Number(stub.net_pay),
    employerTaxTotal:
      Number(stub.social_security_employer) + Number(stub.medicare_employer) + Number(stub.futa_employer) + Number(stub.suta_employer),
    ytdGross: Number(stub.ytd_gross),
    ytdFederalTax: Number(stub.ytd_federal_tax),
    ytdSsEmployee: Number(stub.ytd_ss_employee),
    ytdMedicareEmployee: Number(stub.ytd_medicare_employee),
    ytdNet: Number(stub.ytd_net),
  };

  const buffer = await renderToBuffer(PaystubDocument({ data }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="paystub-${stub.employees?.name?.replace(/\s+/g, "-") ?? "employee"}-${stub.pay_runs.pay_date}.pdf"`,
    },
  });
}
