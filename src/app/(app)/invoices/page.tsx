import ScreenHeader from "@/components/ScreenHeader";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function statusBadge(status: string, dueDate: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (status !== "paid" && status !== "void" && dueDate && dueDate < today) {
    const days = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    return (
      <span className="badge badge-alert">
        Overdue {days}d
      </span>
    );
  }
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const style = status === "paid" ? { borderColor: "var(--moss-lite)", color: "var(--moss-lite)" } : {};
  return (
    <span className="badge" style={style}>
      {label}
    </span>
  );
}

export default async function InvoicesPage() {
  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("id, invoice_number, status, total_amount, issued_date, due_date, clients(name)")
    .order("created_at", { ascending: false });

  const rows = invoices || [];
  const billed = rows.filter((i) => i.status !== "void").reduce((s, i) => s + Number(i.total_amount), 0);
  const collected = rows.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0);
  const outstanding = billed - collected;

  return (
    <main>
      <ScreenHeader
        sheetCode="REV-06"
        contextLabel="Issued documents"
        title="Invoices"
        actions={
          <>
            <button className="btn-secondary active">All</button>
            <button className="btn-secondary">Open</button>
            <button className="btn-secondary">Overdue</button>
            <button className="btn-primary" disabled title="Manual invoice creation lands with Phase B">
              New Invoice
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Billed · {rows.length} invoices</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${billed.toFixed(2)}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Collected</div>
          <div className="stat-figure figure" style={{ color: "var(--moss-lite)" }}>
            ${collected.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {billed > 0 ? `${Math.round((collected / billed) * 100)}% of billed` : "—"}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Outstanding</div>
          <div className="stat-figure figure" style={{ color: outstanding > 0 ? "var(--oxide)" : "var(--white)" }}>
            ${outstanding.toFixed(2)}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="panel" style={{ padding: 20 }}>
          <p style={{ color: "var(--text-dim)", margin: 0 }}>
            No invoices generated yet — batch selected work on the Billing Board once invoice generation
            (Phase B) ships.
          </p>
        </div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="money">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="table-value">{inv.invoice_number}</td>
                  <td>{inv.clients?.name ?? "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{inv.issued_date ?? "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{inv.due_date ?? "—"}</td>
                  <td className="money table-value figure">${Number(inv.total_amount).toFixed(2)}</td>
                  <td>{statusBadge(inv.status, inv.due_date)}</td>
                  <td>
                    <a href={`/invoices/${inv.id}`}>View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
