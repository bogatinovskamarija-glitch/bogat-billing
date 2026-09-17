import ScreenHeader from "@/components/ScreenHeader";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getBalanceSheet(asOf: string) {
  const { data: accounts } = await supabaseAdmin.from("accounts").select("id, name, type, normal_balance");
  const { data: lines } = await supabaseAdmin
    .from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(entry_date)")
    .lte("journal_entries.entry_date", asOf);

  const balanceFor = (acct: { id: string; normal_balance: string }) => {
    const acctLines = (lines || []).filter((l: any) => l.account_id === acct.id);
    const debit = acctLines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const credit = acctLines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    return acct.normal_balance === "debit" ? debit - credit : credit - debit;
  };

  const rows = (accounts || []).map((a) => ({ ...a, balance: balanceFor(a) }));
  const assets = rows.filter((r) => r.type === "asset" && r.balance !== 0);
  const liabilities = rows.filter((r) => r.type === "liability" && r.balance !== 0);
  const equityAccounts = rows.filter((r) => r.type === "equity" && r.balance !== 0);
  const revenue = rows.filter((r) => r.type === "revenue");
  const expense = rows.filter((r) => r.type === "expense");

  const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
  const totalEquityAccounts = equityAccounts.reduce((s, r) => s + r.balance, 0);
  const netIncomeToDate = revenue.reduce((s, r) => s + r.balance, 0) - expense.reduce((s, r) => s + r.balance, 0);
  const totalEquity = totalEquityAccounts + netIncomeToDate;

  return { assets, liabilities, equityAccounts, netIncomeToDate, totalAssets, totalLiabilities, totalEquity };
}

export default async function BalanceSheetPage({ searchParams }: { searchParams: { asOf?: string } }) {
  const asOf = searchParams.asOf || new Date().toISOString().slice(0, 10);
  const { assets, liabilities, equityAccounts, netIncomeToDate, totalAssets, totalLiabilities, totalEquity } = await getBalanceSheet(asOf);
  const balances = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return (
    <main>
      <ScreenHeader
        sheetCode="FIN-03"
        contextLabel={`As of ${asOf}`}
        title="Balance Sheet"
        actions={
          <a href={`/api/reports/balance-sheet/pdf?asOf=${asOf}`} target="_blank" className="btn-secondary" style={{ display: "inline-block" }}>
            Export PDF
          </a>
        }
      />

      <form method="get" style={{ display: "flex", gap: 10, marginBottom: "var(--space-group)", alignItems: "flex-end" }}>
        <div>
          <label className="label">As of</label>
          <input type="date" name="asOf" defaultValue={asOf} style={{ display: "block", padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }} />
        </div>
        <button type="submit" className="btn-secondary">
          Update
        </button>
      </form>

      <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
        <div className="panel-title" style={{ padding: "16px 20px 0" }}>
          Assets
        </div>
        <table>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td style={{ color: "var(--text-dim)" }}>No asset activity yet.</td>
              </tr>
            )}
            {assets.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td className="money table-value figure">${a.balance.toFixed(2)}</td>
              </tr>
            ))}
            <tr style={{ background: "var(--raised)" }}>
              <td className="table-value">Total Assets</td>
              <td className="money table-value figure">${totalAssets.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
        <div className="panel-title" style={{ padding: "16px 20px 0" }}>
          Liabilities
        </div>
        <table>
          <tbody>
            {liabilities.length === 0 && (
              <tr>
                <td style={{ color: "var(--text-dim)" }}>No liabilities yet.</td>
              </tr>
            )}
            {liabilities.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td className="money table-value figure">${l.balance.toFixed(2)}</td>
              </tr>
            ))}
            <tr style={{ background: "var(--raised)" }}>
              <td className="table-value">Total Liabilities</td>
              <td className="money table-value figure">${totalLiabilities.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
        <div className="panel-title" style={{ padding: "16px 20px 0" }}>
          Equity
        </div>
        <table>
          <tbody>
            {equityAccounts.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td className="money table-value figure">${e.balance.toFixed(2)}</td>
              </tr>
            ))}
            <tr>
              <td>Retained Earnings (net income to date)</td>
              <td className="money table-value figure">${netIncomeToDate.toFixed(2)}</td>
            </tr>
            <tr style={{ background: "var(--raised)" }}>
              <td className="table-value">Total Equity</td>
              <td className="money table-value figure">${totalEquity.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        className="panel"
        style={{ padding: 20, background: balances ? "rgba(59, 82, 55, 0.62)" : "var(--oxide-bg)", borderColor: balances ? "var(--canopy-lt)" : "var(--oxide)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="panel-title" style={{ color: balances ? "var(--white)" : "var(--oxide)" }}>
            Assets = Liabilities + Equity
          </span>
          <span className="stat-figure figure" style={{ color: balances ? "var(--moss-lite)" : "var(--oxide)" }}>
            ${totalAssets.toFixed(2)} {balances ? "=" : "≠"} ${(totalLiabilities + totalEquity).toFixed(2)}
          </span>
        </div>
      </div>
    </main>
  );
}
