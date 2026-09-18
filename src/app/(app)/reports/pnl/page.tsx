import ScreenHeader from "../../../../components/ScreenHeader";
import DonutChart from "../../../../components/DonutChart";
import { supabaseAdmin } from "../../../../lib/supabase";
import { fetchAllJournalLines } from "../../../../lib/ledger";

export const dynamic = "force-dynamic";

async function getPnl(start: string, end: string) {
  const { data: accounts } = await supabaseAdmin.from("accounts").select("id, code, name, type, normal_balance").in("type", ["revenue", "expense"]);
  const lines = await fetchAllJournalLines({ gte: start, lte: end });

  const rows = (accounts || []).map((acct) => {
    const acctLines = lines.filter((l) => l.account_id === acct.id);
    const debit = acctLines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const credit = acctLines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    const balance = acct.normal_balance === "debit" ? debit - credit : credit - debit;
    return { ...acct, balance };
  });

  const revenue = rows.filter((r) => r.type === "revenue" && r.balance !== 0);
  const expenses = rows.filter((r) => r.type === "expense" && r.balance !== 0);
  const totalRevenue = revenue.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  // EBITDA = Net Income + interest + taxes + depreciation + amortization.
  // Computed generically off account names rather than hardcoded codes, so
  // it picks up the addback automatically the moment such an account
  // exists — today there is no Interest, Income Tax, Depreciation, or
  // Amortization account in the chart of accounts at all (the LLC is
  // pass-through, so no entity-level income tax; Fixed Assets exist but
  // aren't being depreciated), so the addback is $0 and EBITDA == Net Income.
  const EBITDA_ADDBACK_PATTERN = /interest|income tax|depreciation|amortization/i;
  const ebitdaAddback = expenses.filter((r) => EBITDA_ADDBACK_PATTERN.test(r.name)).reduce((s, r) => s + r.balance, 0);
  const ebitda = netIncome + ebitdaAddback;

  return { revenue, expenses, totalRevenue, totalExpenses, netIncome, ebitda, ebitdaAddback };
}

export default async function PnlPage({ searchParams }: { searchParams: { start?: string; end?: string } }) {
  const now = new Date();
  const start = searchParams.start || `${now.getFullYear()}-01-01`;
  const end = searchParams.end || now.toISOString().slice(0, 10);
  const { revenue, expenses, totalRevenue, totalExpenses, netIncome, ebitda, ebitdaAddback } = await getPnl(start, end);

  return (
    <main>
      <ScreenHeader
        sheetCode="FIN-02"
        contextLabel={`${start} to ${end}`}
        title="Profit & Loss"
        actions={
          <a href={`/api/reports/pnl/pdf?start=${start}&end=${end}`} target="_blank" className="btn-secondary" style={{ display: "inline-block" }}>
            Export PDF
          </a>
        }
      />

      <form method="get" style={{ display: "flex", gap: 10, marginBottom: "var(--space-group)", alignItems: "flex-end" }}>
        <div>
          <label className="label">Start</label>
          <input type="date" name="start" defaultValue={start} style={{ display: "block", padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }} />
        </div>
        <div>
          <label className="label">End</label>
          <input type="date" name="end" defaultValue={end} style={{ display: "block", padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }} />
        </div>
        <button type="submit" className="btn-secondary">
          Update
        </button>
      </form>

      {expenses.length > 1 && (
        <div className="panel" style={{ padding: 20, marginBottom: "var(--space-group)" }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>
            Expense mix
          </div>
          <DonutChart data={expenses.map((r) => ({ label: r.name, value: r.balance }))} centerLabel="Total expenses" />
        </div>
      )}

      <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
        <div className="panel-title" style={{ padding: "16px 20px 0" }}>
          Revenue
        </div>
        <table>
          <tbody>
            {revenue.length === 0 ? (
              <tr>
                <td style={{ color: "var(--text-dim)" }}>No revenue posted in this period.</td>
              </tr>
            ) : (
              revenue.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="money table-value figure">${r.balance.toFixed(2)}</td>
                </tr>
              ))
            )}
            <tr style={{ background: "var(--raised)" }}>
              <td className="table-value">Total Revenue</td>
              <td className="money table-value figure">${totalRevenue.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
        <div className="panel-title" style={{ padding: "16px 20px 0" }}>
          Expenses
        </div>
        <table>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td style={{ color: "var(--text-dim)" }}>No expenses posted in this period.</td>
              </tr>
            ) : (
              expenses.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="money table-value figure">${r.balance.toFixed(2)}</td>
                </tr>
              ))
            )}
            <tr style={{ background: "var(--raised)" }}>
              <td className="table-value">Total Expenses</td>
              <td className="money table-value figure">${totalExpenses.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ padding: 20, background: "rgba(59, 82, 55, 0.62)", borderColor: "var(--canopy-lt)", marginBottom: "var(--space-group)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="panel-title" style={{ color: "var(--white)" }}>
            Net Income
          </span>
          <span className="stat-figure figure" style={{ color: netIncome >= 0 ? "var(--moss-lite)" : "var(--oxide)" }}>
            ${netIncome.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="panel-title">EBITDA</span>
          <span className="stat-figure figure" style={{ color: ebitda >= 0 ? "var(--moss-lite)" : "var(--oxide)" }}>
            ${ebitda.toFixed(2)}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10, marginBottom: 0 }}>
          {ebitdaAddback === 0
            ? "Currently identical to Net Income: there's no Interest, Income Tax, Depreciation, or Amortization account in the chart of accounts yet (the LLC is pass-through, so no entity-level income tax applies; Fixed Assets exist but aren't being depreciated). This figure will diverge from Net Income automatically once one of those is tracked."
            : `Net Income + $${ebitdaAddback.toFixed(2)} in interest/tax/depreciation/amortization addbacks for this period.`}
        </p>
      </div>
    </main>
  );
}
