import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabase";
import InvoiceDocument, { InvoicePdfData } from "@/pdf/InvoiceDocument";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*, clients(name, contact_name, billing_address)")
    .eq("id", params.id)
    .single();
  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("task_name, hours, hourly_rate, amount, projects(name)")
    .eq("invoice_id", params.id)
    .order("sort_order");

  const projectNames = Array.from(
    new Set((lineItems || []).map((l: any) => l.projects?.name).filter(Boolean))
  ).join(", ");

  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoice_number,
    issuedDate: invoice.issued_date,
    dueDate: invoice.due_date,
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
    clientName: invoice.clients?.name ?? "—",
    contactName: invoice.clients?.contact_name ?? null,
    billingAddress: invoice.clients?.billing_address ?? null,
    projectNames: projectNames || "—",
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.tax_amount),
    totalAmount: Number(invoice.total_amount),
    lineItems: (lineItems || []).map((l: any) => ({
      taskName: l.task_name,
      hours: Number(l.hours),
      hourlyRate: Number(l.hourly_rate),
      amount: Number(l.amount),
    })),
  };

  const buffer = await renderToBuffer(InvoiceDocument({ data }));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
