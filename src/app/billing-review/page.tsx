import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import SyncAndAssignPanel from "@/components/SyncAndAssignPanel";

export const dynamic = "force-dynamic";

async function getClients() {
  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, company_name")
    .order("name");
  if (error) throw error;

  const { data: allProjects } = await supabaseAdmin
    .from("projects")
    .select("id, name, client_id, is_active");

  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("client_id, issued_date")
    .order("issued_date", { ascending: false });

  const activeProjects = (allProjects || []).filter((p) => p.is_active);
  const clientRows = (clients || []).map((client) => {
    const projectCount = activeProjects.filter((p) => p.client_id === client.id).length;
    const lastInvoice = (invoices || []).find((i) => i.client_id === client.id);
    return { ...client, projectCount, lastInvoicedDate: lastInvoice?.issued_date ?? null };
  });

  const unassignedProjects = activeProjects.filter((p) => !p.client_id).map((p) => ({ id: p.id, name: p.name }));

  return { clientRows, unassignedProjects };
}

export default async function BillingReviewPage() {
  const { clientRows: clients, unassignedProjects } = await getClients();

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ color: "var(--brand-primary)", fontWeight: 600 }}>Billing Review</h1>
        <Link href="/invoices" style={{ fontSize: "0.9rem" }}>
          Invoice history →
        </Link>
      </div>

      <SyncAndAssignPanel unassignedProjects={unassignedProjects} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />

      {clients.length === 0 ? (
        <div className="card">
          <p>No clients yet. Sync projects from ClickUp above, then add a client and assign a project to it.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Active projects</th>
                <th>Last invoiced</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>
                    <strong>{client.name}</strong>
                    {client.company_name && (
                      <div style={{ fontSize: "0.85rem", color: "#777" }}>{client.company_name}</div>
                    )}
                  </td>
                  <td>{client.projectCount}</td>
                  <td>{client.lastInvoicedDate ?? "—"}</td>
                  <td>
                    <Link href={`/billing-review/${client.id}`}>Review →</Link>
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
