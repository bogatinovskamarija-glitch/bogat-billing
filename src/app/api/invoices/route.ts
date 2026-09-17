import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

interface SelectedTask {
  clickupTaskId: string;
  clickupListId: string;
  projectId: string;
  taskName: string;
  phase: string | null;
  closedDate: string | null; // ClickUp epoch-ms string
  hours: number;
  hourlyRate: number;
  amount: number;
  progressNarrative: string;
}

interface ClientSelection {
  clientId: string;
  items: SelectedTask[];
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BOGAT-${year}-`;
  const { data } = await supabaseAdmin
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSeq = data?.invoice_number ? parseInt(data.invoice_number.slice(prefix.length), 10) : 0;
  const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// Generates one invoice per client from a Billing Board selection. The
// existing unique(clickup_task_id) constraint on invoice_line_items is the
// real anti-double-billing gate — a task already invoiced elsewhere (e.g. a
// race between two tabs) fails that one insert without blocking the rest of
// the client's invoice.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { selections: ClientSelection[] };
  if (!body?.selections?.length) {
    return NextResponse.json({ error: "selections is required" }, { status: 400 });
  }

  const created: { clientId: string; invoiceId: string; invoiceNumber: string }[] = [];
  const skipped: { clickupTaskId: string; reason: string }[] = [];

  for (const selection of body.selections) {
    const items = selection.items;
    if (!items || items.length === 0) continue;

    const subtotal = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30); // Net 30, per the mockup's sample invoice

    const closedTimes = items.map((i) => Number(i.closedDate)).filter((n) => Number.isFinite(n) && n > 0);
    const periodStart = closedTimes.length ? new Date(Math.min(...closedTimes)).toISOString().slice(0, 10) : null;
    const periodEnd = closedTimes.length ? new Date(Math.max(...closedTimes)).toISOString().slice(0, 10) : null;

    const invoiceNumber = await nextInvoiceNumber();

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        client_id: selection.clientId,
        status: "draft",
        subtotal,
        tax_amount: 0,
        total_amount: subtotal,
        period_start: periodStart,
        period_end: periodEnd,
        issued_date: today.toISOString().slice(0, 10),
        due_date: dueDate.toISOString().slice(0, 10),
      })
      .select("id, invoice_number")
      .single();

    if (invoiceError || !invoice) {
      skipped.push(...items.map((i) => ({ clickupTaskId: i.clickupTaskId, reason: "invoice creation failed" })));
      continue;
    }

    for (const [index, item] of items.entries()) {
      const { error: lineError } = await supabaseAdmin.from("invoice_line_items").insert({
        invoice_id: invoice.id,
        project_id: item.projectId,
        clickup_task_id: item.clickupTaskId,
        clickup_list_id: item.clickupListId,
        task_name: item.taskName,
        phase: item.phase,
        hours: item.hours,
        hourly_rate: item.hourlyRate,
        amount: item.amount,
        progress_narrative: item.progressNarrative,
        narrative_source: "raw_comments",
        sort_order: index,
      });
      if (lineError) {
        skipped.push({ clickupTaskId: item.clickupTaskId, reason: "already invoiced" });
      }
    }

    // Recompute totals in case any line item was skipped as already-invoiced.
    const { data: keptLines } = await supabaseAdmin
      .from("invoice_line_items")
      .select("amount")
      .eq("invoice_id", invoice.id);
    const actualSubtotal = Math.round((keptLines || []).reduce((s, l) => s + Number(l.amount), 0) * 100) / 100;
    if (actualSubtotal !== subtotal) {
      await supabaseAdmin
        .from("invoices")
        .update({ subtotal: actualSubtotal, total_amount: actualSubtotal })
        .eq("id", invoice.id);
    }

    created.push({ clientId: selection.clientId, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number });
  }

  return NextResponse.json({ created, skipped });
}
