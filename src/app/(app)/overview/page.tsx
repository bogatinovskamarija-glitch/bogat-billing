import Link from "next/link";
import ScreenHeader from "../../../components/ScreenHeader";
import RevenueChart, { MonthBucket } from "../../../components/RevenueChart";
import BarChart from "../../../components/BarChart";
import { supabaseAdmin } from "../../../lib/supabase";
import { getCandidatesForClient, getInvoicedTaskMap, getTaskOverrides, getBillableEmployees } from "../../../lib/billing-candidates";
import { getProjectRevenue, getBilledCollectedYTD } from "../../../lib/client-revenue";
import { getOpenPipelineSummary } from "../../../lib/pipeline";

export const dynamic = "force-dynamic";

async function getRollup() {
  const { data: invoices } = await supabaseAdmin
    .from("invoices")
    .select("total_amount, status, issued_date, client_id")
    .neq("status", "void");

  const { billedYTD, collectedYTD } = await getBilledCollectedYTD();
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
  const overridesMap = await getTaskOverrides();
  const employees = await getBillableEmployees();

  let wipUnbilled = 0;
  let readyTotal = 0;
  let readyClients = new Set<string>();
  let readyTasks = 0;
  let oldestReadyDays = 0;

  for (const client of clients || []) {
    const clientProjects = (projects || []).filter((p) => p.client_id === client.id);
    if (clientProjects.length === 0) continue;

    const unbilled = await getCandidatesForClient(client, clientProjects, "unbilled", invoicedMap, employees, overridesMap);
    wipUnbilled += unbilled.accumulatedTotal;

    const ready = await getCandidatesForClient(client, clientProjects, "ready", invoicedMap, employees, overridesMap);
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
  const revenueMap = await getProjectRevenue((allProjects || []).map((p: any) => p.id));

  const byProject = (allProjects || []).map((p: any) => {
    const rev = revenueMap.get(p.id) ?? { billed: 0, collected: 0 };
    const contractValue = p.contract_value ? Number(p.contract_value) : null;
    return { id: p.id, name: p.name, clientName: p.clients?.name ?? "—", billed: rev.billed, collected: rev.collected, contractValue };
  });

  // Expenses widget — top categories this month, posted expenses only.
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
  const { data: monthExpenses } = await supabaseAdmin
    .from("expenses")
    .select("amount, accounts(name)")
    .eq("status", "categorized")
    .gte("expense_date", monthStart);
  const byCategory = new Map<string, number>();
  (monthExpenses || []).forEach((e: any) => {
    const name = e.accounts?.name ?? "Other";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(e.amount));
  });
  const expensesByCategory = Array.from(byCategory.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Pipeline widget — live from ClickUp, same computation /api/pipeline uses.
  const pipeline = await getOpenPipelineSummary();

  // Payroll widget — YTD gross wages + active headcount.
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const { data: ytdStubs } = await supabaseAdmin
    .from("paystubs")
    .select("gross_pay, pay_runs!inner(status, pay_date)")
    .eq("pay_runs.status", "finalized")
    .gte("pay_runs.pay_date", yearStart);
  const payrollYtdGross = (ytdStubs || []).reduce((s: number, r: any) => s + Number(r.gross_pay), 0);
  const { count: activeHeadcount } = await supabaseAdmin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  return {
    billedYTD,
    collectedYTD,
    outstandingAR,
    months,
    wipUnbilled,
    readyTotal,
    readyClients: readyClients.size,
    readyTasks,
    oldestReadyDays,
    byProject,
    expensesByCategory,
    pipeline,
    payrollYtdGross,
    activeHeadcount: activeHeadcount ?? 0,
  };
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-group)", marginTop: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>
            Expenses this month
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 0, marginBottom: 14 }}>
            <Link href="/expenses">By category →</Link>
          </p>
          <BarChart data={r.expensesByCategory} emptyLabel="No posted expenses this month yet." />
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>
            Open pipeline
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 0, marginBottom: 14 }}>
            ${r.pipeline.openValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {r.pipeline.dealCount} live deals ·{" "}
            <Link href="/pipeline">By source →</Link>
          </p>
          <BarChart data={r.pipeline.bySource} emptyLabel="No open deals with a value yet." />
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>
            Payroll
          </div>
          <div className="label">YTD gross wages</div>
          <div className="stat-figure figure" style={{ color: "var(--white)", marginBottom: 16 }}>
            ${r.payrollYtdGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="label">Active headcount</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            {r.activeHeadcount}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 16, marginBottom: 0 }}>
            <Link href="/payroll">Open payroll →</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
