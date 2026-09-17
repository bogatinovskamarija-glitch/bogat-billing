import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, status, total_amount, issued_date, client_id, clients(name)")
    .order("created_at", { ascending: false });

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <Link href="/billing-review" style={{ fontSize: "0.85rem" }}>
        ← Billing Review
      </Link>
      <h1 style={{ color: "var(--brand-primary)", fontWeight: 600, margin: "8px 0 24px" }}>Invoices</h1>

      {!invoices || invoices.length === 0 ? (
        <div className="card">
          <p>No invoices generated yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Status</th>
                <th>Total</th>
                <th>Issued</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`}>{inv.invoice_number}</Link>
                  </td>
                  <td>{inv.clients?.name ?? "—"}</td>
                  <td>{inv.status}</td>
                  <td>${Number(inv.total_amount).toFixed(2)}</td>
                  <td>{inv.issued_date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
