import Link from "next/link";
import ScreenHeader from "@/components/ScreenHeader";
import RevenueChart, { MonthBucket } from "@/components/RevenueChart";
import { supabaseAdmin } from "@/lib/supabase";
import { getCandidatesForClient, getInvoicedTaskMap } from "@/lib/billing-candidates";

export const dynamic = "force-dynamic";

async function getRollup() {
  const yearStart = `${new Date().getFullYear()}-01-01`;

  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("total_amount, status, issued_date, client_id")
    .neq("status", "void");

  const ytdInvoices = (invoices || []).filter((i) => (i.issued_date ?? "") >= yearStart);
  const billedYTD = ytdInvoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const collectedYTD = ytdInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0);
  const outstandingAR = billedYTD - collectedYTD;

  // Revenue by month — last 6 months, from real invoice issue dates.
  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const monthKey = d.toISOString().slice(0, 7);
    const monthInvoices = (invoices || []).filter((inv) => (inv.issued_date ?? "").slice(0, 7) === monthKey);
    months.push({
      label,
      collected: monthInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0),
      billedUncollected: monthInvoices.filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.total_amount), 0),
    });
  }

  // WIP unbilled + Ready-to-invoice — live ClickUp, same aggregation Billing Board uses.
  const { data: clients } = await supabaseAdmin.from("clients").select("id, name, default_hourly_rate");
  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name, current_phase, clickup_list_id, hourly_rate, client_id, hourly_rate")
    .eq("is_active", true)
    .not("client_id", "is", null);
  const invoicedMap = await getInvoicedTaskMap();

  let wipUnbilled = 0;
  let readyTotal = 0;
  let readyClients = new Set<string>();
  let readyTasks = 0;
  let oldestReadyDays = 0;

  for (const client of clients || []) {
    const clientProjects = (projects || []).filter((p) => p.client_id === client.id);
    if (clientProjects.length === 0) continue;

    const unbilled = await getCandidatesForClient(client, clientProjects, "unbilled", invoicedMap);
    wipUnbilled += unbilled.accumulatedTotal;

    const ready = await getCandidatesForClient(client, clientProjects, "ready", invoicedMap);
    if (ready.taskCount > 0) {
      readyTotal += ready.accumulatedTotal;
      readyClients.add(client.id);
      readyTasks += ready.taskCount;
      ready.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (t.closedDate) {
            const days = Math.floor((Date.now() - Number(t.closedDate)) / 86400000);
            if (days > oldestReadyDays) oldestReadyDays = days;
          }
        })
      );
    }
  }

  // By-project table
  const { data: allProjects } = await supabaseAdmin
    .from("projects")
    .select("id, name, is_active, client_id, contract_value, clients(name)")
    .eq("is_active", true);
  const { data: lineItemsByProject } = await supabaseAdmin
    .from("invoice_line_items")
    .select("project_id, amount, invoices(status)");

  const byProject = (allProjects || []).map((p: any) => {
    const items = (lineItemsByProject || []).filter((l: any) => l.project_id === p.id);
    const billed = items.reduce((s: number, l: any) => s + Number(l.amount), 0);
    const collected = items.filter((l: any) => l.invoices?.status === "paid").reduce((s: number, l: any) => s + Number(l.amount), 0);
    const contractValue = p.contract_value ? Number(p.contract_value) : null;
    return { id: p.id, name: p.name, clientName: p.clients?.name ?? "—", billed, collected, contractValue };
  });

  return { billedYTD, collectedYTD, outstandingAR, months, wipUnbilled, readyTotal, readyClients: readyClients.size, readyTasks, oldestReadyDays, byProject };
}

export default async function OverviewPage() {
  const r = await getRollup();

  return (
    <main>
      <div
        style={{
          position: "relative",
          marginLeft: -40,
          marginRight: -40,
          marginTop: -40,
          padding: "40px",
          overflow: "hidden",
          marginBottom: "var(--space-group)",
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/brand/house-film-poster.jpg"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
        >
          <source src="/brand/house-film.mp4" type="video/mp4" />
        </video>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, var(--floor) 20%, transparent 60%)", zIndex: 1 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--floor) 0%, transparent 55%)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <ScreenHeader sheetCode="FIN-01" contextLabel={`Financial rollup · ${new Date().getFullYear()}`} title="Overview" />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-related)" }}>
            <div>
              <div className="label">Billed YTD</div>
              <div className="hero-figure figure" style={{ color: "var(--white)" }}>
                ${r.billedYTD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="label">Collected YTD</div>
              <div className="hero-figure figure" style={{ color: "var(--moss-lite)" }}>
                ${r.collectedYTD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {r.billedYTD > 0 ? `${Math.round((r.collectedYTD / r.billedYTD) * 100)}% of billed` : "—"}
              </div>
            </div>
            <div>
              <div className="label">WIP unbilled</div>
              <div className="hero-figure figure" style={{ color: "var(--white)" }}>
                ${r.wipUnbilled.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>live from ClickUp</div>
            </div>
            <div>
              <div className="label">Outstanding A/R</div>
              <div className="hero-figure figure" style={{ color: r.outstandingAR > 0 ? "var(--oxide)" : "var(--white)" }}>
                ${r.outstandingAR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {r.readyClients > 0 && (
        <div
          className="panel"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 20,
            marginBottom: "var(--space-group)",
            background: "rgba(59, 82, 55, 0.62)",
            borderColor: "var(--canopy-lt)",
          }}
        >
          <div>
            <div className="panel-title" style={{ color: "var(--text-dim)" }}>
              Ready to invoice
            </div>
            <div className="stat-figure figure" style={{ color: "var(--white)" }}>
              ${r.readyTotal.toFixed(2)}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
              {r.readyClients} clients · {r.readyTasks} completed tasks
              {r.oldestReadyDays > 0 && ` · oldest sitting ${r.oldestReadyDays} days`}
            </div>
          </div>
          <Link href="/billing-board" className="btn-primary" style={{ display: "inline-block" }}>
            Open Billing Board
          </Link>
        </div>
      )}

      <div className="panel" style={{ padding: 20, marginBottom: "var(--space-group)" }}>
        <div className="panel-title" style={{ marginBottom: 16 }}>
          Revenue by month
        </div>
        <RevenueChart data={r.months} />
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 16, marginBottom: 0 }}>
          Collected vs. billed-but-uncollected, from real invoice history. WIP unbilled is a live snapshot
          (above), not a monthly history — there's no meaningful "WIP for March" once work becomes billable.
        </p>
      </div>

      <div className="panel">
        <div className="panel-title" style={{ padding: "16px 20px 0" }}>
          By project
        </div>
        {r.byProject.length === 0 ? (
          <p style={{ padding: 20, color: "var(--text-dim)" }}>No active projects assigned to a client yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project / Client</th>
                <th className="money">Contract</th>
                <th className="money">Billed</th>
                <th className="money">Collected</th>
                <th>Billed vs contract</th>
              </tr>
            </thead>
            <tbody>
              {r.byProject.map((p) => {
                const pct = p.contractValue ? Math.min(100, Math.round((p.billed / p.contractValue) * 100)) : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="table-value">{p.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{p.clientName}</div>
                    </td>
                    <td className="money table-value figure">{p.contractValue ? `$${p.contractValue.toFixed(2)}` : "—"}</td>
                    <td className="money table-value figure">${p.billed.toFixed(2)}</td>
                    <td className="money table-value figure">${p.collected.toFixed(2)}</td>
                    <td style={{ minWidth: 140 }}>
                      {pct !== null ? (
                        <>
                          <div style={{ height: 4, background: "var(--line)", width: "100%" }}>
                            <div style={{ height: 4, background: "var(--moss-lite)", width: `${pct}%` }} />
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                            {pct}% billed · ${(p.contractValue! - p.billed).toFixed(0)} left
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>no contract value</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
