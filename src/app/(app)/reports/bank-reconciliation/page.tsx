"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "../../../../components/ScreenHeader";

interface Reconciliation {
  id: string;
  reconciliation_date: string;
  statement_balance: number;
  ledger_balance: number;
  difference: number;
  notes: string | null;
}

export default function BankReconciliationPage() {
  const [ledgerBalance, setLedgerBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ reconciliationDate: new Date().toISOString().slice(0, 10), statementBalance: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/bank-reconciliation");
    const data = await res.json();
    setLedgerBalance(data.ledgerBalance ?? 0);
    setHistory(data.history || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.statementBalance) return;
    setSaving(true);
    await fetch("/api/bank-reconciliation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reconciliationDate: form.reconciliationDate,
        statementBalance: Number(form.statementBalance),
        notes: form.notes || undefined,
      }),
    });
    setSaving(false);
    setForm({ reconciliationDate: new Date().toISOString().slice(0, 10), statementBalance: "", notes: "" });
    await load();
  }

  const previewDiff = form.statementBalance && ledgerBalance !== null ? Number(form.statementBalance) - ledgerBalance : null;

  return (
    <main>
      <ScreenHeader
        sheetCode="FIN-05"
        contextLabel="Verify the ledger against your actual bank balance"
        title="Bank Reconciliation"
      />

      <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: -8, marginBottom: "var(--space-group)", maxWidth: 640 }}>
        Do this monthly. It's the thing that would have caught the balance sheet corruption in weeks instead of a year —
        type in what your bank statement actually says, and it tells you immediately whether the ledger agrees.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-group)", marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Ledger cash balance (live)</div>
          <div className="hero-figure figure" style={{ color: "var(--white)" }}>
            {loading || ledgerBalance === null ? "…" : `$${ledgerBalance.toFixed(2)}`}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8, marginBottom: 0 }}>
            Sum of every real (non-test) posting to Cash — Operating, right now.
          </p>
        </div>

        <form onSubmit={handleSave} className="panel" style={{ padding: 20 }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>
            Record a reconciliation
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>As of date</label>
              <input
                type="date"
                required
                value={form.reconciliationDate}
                onChange={(e) => setForm((f) => ({ ...f, reconciliationDate: e.target.value }))}
                style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
              />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 6 }}>Statement balance</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.statementBalance}
                onChange={(e) => setForm((f) => ({ ...f, statementBalance: e.target.value }))}
                style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
              />
            </div>
          </div>
          <label className="label" style={{ display: "block", marginBottom: 6 }}>Notes (optional)</label>
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%", marginBottom: 14 }}
          />
          {previewDiff !== null && (
            <p style={{ fontSize: 13, marginBottom: 14, color: Math.abs(previewDiff) < 0.01 ? "var(--moss-lite)" : "var(--oxide)" }}>
              {Math.abs(previewDiff) < 0.01
                ? "Matches the ledger exactly."
                : `Off by $${Math.abs(previewDiff).toFixed(2)} ${previewDiff > 0 ? "(statement higher)" : "(ledger higher)"} — something in the ledger needs review before saving this.`}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save reconciliation"}
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-title" style={{ padding: "16px 20px 0" }}>
          History
        </div>
        {history.length === 0 ? (
          <p style={{ padding: 20, color: "var(--text-dim)" }}>No reconciliations recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="money">Statement</th>
                <th className="money">Ledger</th>
                <th className="money">Difference</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: "var(--text-dim)" }}>{r.reconciliation_date}</td>
                  <td className="money table-value figure">${Number(r.statement_balance).toFixed(2)}</td>
                  <td className="money table-value figure">${Number(r.ledger_balance).toFixed(2)}</td>
                  <td
                    className="money table-value figure"
                    style={{ color: Math.abs(Number(r.difference)) < 0.01 ? "var(--moss-lite)" : "var(--oxide)" }}
                  >
                    ${Number(r.difference).toFixed(2)}
                  </td>
                  <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
