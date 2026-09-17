import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../../lib/supabase";
import InvoiceActions from "../../../../components/InvoiceActions";

export const dynamic = "force-dynamic";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("*, clients(name, contact_name, contact_phone, contact_email, billing_address)")
    .eq("id", params.invoiceId)
    .single();
  if (!invoice) notFound();

  const { data: lineItems } = await supabaseAdmin
    .from("invoice_line_items")
    .select("task_name, hours, hourly_rate, amount, phase_billing_id, rate_breakdown, projects(name)")
    .eq("invoice_id", params.invoiceId)
    .order("sort_order");

  const projectNames = Array.from(
    new Set((lineItems || []).map((l: any) => l.projects?.name).filter(Boolean))
  ).join(", ");

  return (
    <main>
      <Link href="/invoices" style={{ fontSize: 13 }}>
        ← Invoices
      </Link>

      <div className="panel" style={{ marginTop: 16, padding: 0, maxWidth: 720 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            background: "rgba(59, 82, 55, 0.7)",
          }}
        >
          <span className="table-value" style={{ color: "var(--white)" }}>
            {invoice.invoice_number}.pdf
          </span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" className="btn-secondary" style={{ display: "inline-block" }}>
              Download
            </a>
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              balanceDue={Number(invoice.total_amount) - Number(invoice.paid_amount)}
            />
          </div>
        </div>

        <div style={{ background: "var(--paper)", color: "var(--paper-ink)", padding: 40 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid var(--paper-heading)",
              paddingBottom: 16,
              marginBottom: 24,
            }}
          >
            <img src="/brand/logo-forest.png" alt="Bogat Architecture" style={{ width: 130 }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, letterSpacing: 1, color: "var(--paper-label)" }}>INVOICE</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--paper-heading)" }}>
                {invoice.invoice_number}
              </div>
              <div style={{ fontSize: 11, color: "var(--paper-label)", marginTop: 8, lineHeight: 1.6 }}>
                BOGAT ARCHITECTURE &amp; DESIGN LLC
                <br />
                FORT LAUDERDALE, FLORIDA
                <br />
                MARIA@BOGATARCHITECTURE.COM
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--paper-label)" }}>BILLED TO</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{invoice.clients?.name ?? "—"}</div>
              {invoice.clients?.contact_name && <div style={{ fontSize: 12 }}>{invoice.clients.contact_name}</div>}
              {invoice.clients?.billing_address && <div style={{ fontSize: 12 }}>{invoice.clients.billing_address}</div>}
              {invoice.clients?.contact_email && <div style={{ fontSize: 12 }}>{invoice.clients.contact_email}</div>}
              {invoice.clients?.contact_phone && <div style={{ fontSize: 12 }}>{invoice.clients.contact_phone}</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--paper-label)" }}>ISSUED</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>{fmtDate(invoice.issued_date)}</div>
              <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--paper-label)" }}>DUE</div>
              <div style={{ fontSize: 12 }}>{fmtDate(invoice.due_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--paper-label)" }}>PROJECT</div>
              <div style={{ fontSize: 12, marginBottom: 8 }}>{projectNames || "—"}</div>
              <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--paper-label)" }}>PERIOD</div>
              <div style={{ fontSize: 12 }}>
                {fmtDate(invoice.period_start)} – {fmtDate(invoice.period_end)}
              </div>
            </div>
          </div>

          <table style={{ marginBottom: 20 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--paper-border)" }}>
                <th style={{ color: "var(--paper-label)", background: "transparent", padding: "0 0 8px" }}>Description</th>
                <th className="money" style={{ color: "var(--paper-label)", background: "transparent", padding: "0 0 8px" }}>
                  Hours
                </th>
                <th className="money" style={{ color: "var(--paper-label)", background: "transparent", padding: "0 0 8px" }}>
                  Rate
                </th>
                <th className="money" style={{ color: "var(--paper-label)", background: "transparent", padding: "0 0 8px" }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {(lineItems || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--paper-row)" }}>
                  <td style={{ padding: "8px 0", color: "var(--paper-ink)" }}>
                    {item.task_name}
                    {item.rate_breakdown && (
                      <div style={{ fontSize: 10, color: "var(--paper-label)", marginTop: 2 }}>{item.rate_breakdown}</div>
                    )}
                  </td>
                  <td className="money figure" style={{ padding: "8px 0" }}>
                    {item.phase_billing_id ? "—" : Number(item.hours).toFixed(2)}
                  </td>
                  <td className="money figure" style={{ padding: "8px 0" }}>
                    {item.phase_billing_id ? "—" : `$${Number(item.hourly_rate).toFixed(2)}`}
                  </td>
                  <td className="money figure" style={{ padding: "8px 0", fontWeight: 600 }}>
                    ${Number(item.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: "var(--paper-label)" }}>Subtotal</span>
                <span className="figure">${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.tax_amount) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: "var(--paper-label)" }}>Tax</span>
                  <span className="figure">${Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.paid_amount) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: "var(--paper-label)" }}>Paid to date</span>
                  <span className="figure">-${Number(invoice.paid_amount).toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "var(--paper-heading)",
                  color: "#FFFFFF",
                  padding: "12px 16px",
                  marginTop: 8,
                }}
              >
                <span style={{ fontSize: 10, letterSpacing: 1 }}>BALANCE DUE</span>
                <span style={{ fontSize: 18, fontWeight: 700 }} className="figure">
                  ${(Number(invoice.total_amount) - Number(invoice.paid_amount)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 32, borderTop: "1px solid var(--paper-border)", paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: "var(--paper-label)" }}>
              PAYABLE BY ACH OR CHECK · REMITTANCE DETAIL ON FILE
            </div>
            <div style={{ fontSize: 9, color: "var(--paper-label)" }}>
              LATE BALANCES ACCRUE PER THE EXECUTED AGREEMENT
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
