"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "../../../../components/ScreenHeader";
import DonutChart from "../../../../components/DonutChart";

interface Row {
  accountId: string;
  code: string;
  name: string;
  budgeted: number;
  actual: number;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function BudgetPage() {
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [recurringMonthlyTotal, setRecurringMonthlyTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/budget?month=${month}`);
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/expenses/recurring")
      .then((r) => r.json())
      .then((d) => setRecurringMonthlyTotal(d.monthlyTotal ?? null));
  }, []);

  async function handleUpdate(accountId: string, value: number) {
    await fetch("/api/budget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, month, budgetedAmount: value }),
    });
    await load();
  }

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <main>
      <ScreenHeader
        sheetCode="FIN-04"
        contextLabel="Manually entered, compared to real ledger activity"
        title="Budget"
        actions={
          <button className="btn-secondary" onClick={() => window.print()}>
            Print
          </button>
        }
      />

      <div className="no-print" style={{ marginBottom: "var(--space-group)" }}>
        <label className="label" style={{ display: "block", marginBottom: 6 }}>
          Month
        </label>
        <input
          type="month"
          value={month.slice(0, 7)}
          onChange={(e) => setMonth(`${e.target.value}-01`)}
          style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }}
        />
      </div>
      <p className="label" style={{ marginBottom: "var(--space-group)" }}>
        {new Date(`${month}T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Budgeted</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${totalBudgeted.toFixed(2)}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Actual</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${totalActual.toFixed(2)}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Variance</div>
          <div className="stat-figure figure" style={{ color: totalActual > totalBudgeted ? "var(--oxide)" : "var(--moss-lite)" }}>
            ${(totalBudgeted - totalActual).toFixed(2)}
          </div>
        </div>
      </div>

      {recurringMonthlyTotal !== null && recurringMonthlyTotal > 0 && (
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -20, marginBottom: "var(--space-group)" }}>
          Reference: ~${recurringMonthlyTotal.toFixed(2)}/mo in detected recurring charges (see Expenses) — use this
          to sanity-check your budgeted amounts above.
        </p>
      )}

      {!loading && rows.filter((r) => r.actual > 0).length > 1 && (
        <div className="panel no-print" style={{ padding: 20, marginBottom: "var(--space-group)" }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>
            Actual spend mix
          </div>
          <DonutChart data={rows.filter((r) => r.actual > 0).map((r) => ({ label: r.name, value: r.actual }))} centerLabel="Actual" />
        </div>
      )}

      <div className="panel">
        {loading ? (
          <p style={{ padding: 20, color: "var(--text-dim)" }}>Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Expense category</th>
                <th className="money">Budgeted</th>
                <th className="money">Actual</th>
                <th className="money">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const variance = r.budgeted - r.actual;
                return (
                  <tr key={r.accountId}>
                    <td className="table-value">{r.name}</td>
                    <td className="money">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={r.budgeted}
                        onBlur={(e) => handleUpdate(r.accountId, Number(e.target.value))}
                        style={{ width: 90, padding: 4, textAlign: "right", background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }}
                      />
                    </td>
                    <td className="money table-value figure">${r.actual.toFixed(2)}</td>
                    <td className="money table-value figure" style={{ color: variance < 0 ? "var(--oxide)" : "var(--text)" }}>
                      ${variance.toFixed(2)}
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
