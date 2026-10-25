"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "../../../components/ScreenHeader";

interface ScheduleRow {
  period_number: number;
  recognition_date: string;
  amount: number;
}

interface Contract {
  id: string;
  subscriber_name: string;
  contract_start: string;
  contract_end: string;
  term_months: number;
  total_amount: number;
  monthly_amount: number;
  processing_fee: number;
  stripe_invoice_id: string | null;
  arena_subscription_schedule: ScheduleRow[];
}

interface Summary {
  arena_mrr: number;
  arena_active_contracts: number;
  arena_deferred_revenue_balance: number;
  stripe_undeposited_balance: number;
}

const inputStyle = { padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" } as const;
const money = (n: number) => `$${Number(n).toFixed(2)}`;

export default function ArenaContractsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ subscriberName: "", startDate: today, termMonths: "6", totalAmount: "", processingFee: "", stripeInvoiceId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/arena-contracts").then((r) => r.json());
    setContracts(res.contracts || []);
    setSummary(res.summary || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/arena-contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(body.error || "Could not save contract");
      return;
    }
    setForm({ subscriberName: "", startDate: today, termMonths: "6", totalAmount: "", processingFee: "", stripeInvoiceId: "" });
    setShowForm(false);
    await load();
  }

  async function handleDelete(c: Contract) {
    if (!confirm(`Delete ${c.subscriber_name}'s contract? This removes the signup entry and all ${c.term_months} scheduled revenue entries from the ledger.`)) return;
    await fetch(`/api/arena-contracts/${c.id}`, { method: "DELETE" });
    await load();
  }

  const recognized = (c: Contract) =>
    c.arena_subscription_schedule.filter((s) => s.recognition_date <= today).reduce((sum, s) => sum + Number(s.amount), 0);
  const nextInstallment = (c: Contract) =>
    [...c.arena_subscription_schedule].sort((a, b) => a.recognition_date.localeCompare(b.recognition_date)).find((s) => s.recognition_date > today);

  return (
    <main>
      <ScreenHeader
        sheetCode="REV-13"
        contextLabel="Prepaid subscriptions, earned month by month"
        title="AREna Contracts"
        actions={
          <button className="btn-secondary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "+ Add prepaid contract"}
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-group)", marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">AREna MRR</div>
          <div className="hero-figure figure" style={{ color: "var(--white)" }}>{money(summary?.arena_mrr ?? 0)}</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Active contracts</div>
          <div className="hero-figure figure" style={{ color: "var(--white)" }}>{summary?.arena_active_contracts ?? 0}</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Deferred revenue (collected, not yet earned)</div>
          <div className="hero-figure figure" style={{ color: "var(--white)" }}>{money(summary?.arena_deferred_revenue_balance ?? 0)}</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">In Stripe, not yet in Chase</div>
          <div className="hero-figure figure" style={{ color: "var(--white)" }}>{money(summary?.stripe_undeposited_balance ?? 0)}</div>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="panel"
          style={{ padding: 20, marginBottom: "var(--space-group)", display: "grid", gridTemplateColumns: "1.4fr 140px 90px 130px 130px 1.4fr auto", gap: 12, alignItems: "end" }}
        >
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Subscriber</label>
            <input required value={form.subscriberName} onChange={(e) => setForm((f) => ({ ...f, subscriberName: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Paid on</label>
            <input type="date" required value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Months</label>
            <input type="number" min="1" max="60" required value={form.termMonths} onChange={(e) => setForm((f) => ({ ...f, termMonths: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Amount charged</label>
            <input type="number" step="0.01" required value={form.totalAmount} onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Stripe fees</label>
            <input type="number" step="0.01" value={form.processingFee} onChange={(e) => setForm((f) => ({ ...f, processingFee: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Stripe invoice ID (optional)</label>
            <input value={form.stripeInvoiceId} onChange={(e) => setForm((f) => ({ ...f, stripeInvoiceId: e.target.value }))} style={inputStyle} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Add"}
          </button>
          {error && <p style={{ gridColumn: "1 / -1", color: "var(--oxide)", margin: 0 }}>{error}</p>}
        </form>
      )}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      ) : (
        <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
          <div className="panel-title" style={{ padding: "16px 20px 0" }}>Contracts ({contracts.length})</div>
          {contracts.length === 0 ? (
            <p style={{ padding: 20, color: "var(--text-dim)" }}>No prepaid contracts yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Subscriber</th>
                  <th>Service period</th>
                  <th className="money">Charged</th>
                  <th className="money">Per month</th>
                  <th className="money">Earned so far</th>
                  <th className="money">Still deferred</th>
                  <th>Next installment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const earned = recognized(c);
                  const next = nextInstallment(c);
                  return (
                    <tr key={c.id}>
                      <td className="table-value">
                        {c.subscriber_name}
                        {c.stripe_invoice_id && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.stripe_invoice_id}</div>}
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{c.contract_start} → {c.contract_end}</td>
                      <td className="money table-value figure">{money(c.total_amount)}</td>
                      <td className="money figure">{money(c.monthly_amount)}</td>
                      <td className="money figure">{money(earned)}</td>
                      <td className="money figure">{money(Number(c.total_amount) - earned)}</td>
                      <td style={{ color: "var(--text-dim)" }}>{next ? `${next.recognition_date} · ${money(next.amount)}` : "Fully earned"}</td>
                      <td>
                        <button className="btn-secondary" onClick={() => handleDelete(c)} style={{ padding: "6px 12px" }}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="panel" style={{ padding: 20 }}>
        <div className="panel-title" style={{ marginBottom: 8 }}>How this is recorded</div>
        <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 13, lineHeight: 1.6 }}>
          When a subscriber pays, the money is booked to Stripe Undeposited Funds and to Deferred Revenue — a liability, because the service hasn't been delivered yet.
          Each month of service completed, one installment moves from Deferred Revenue to AREna AI Revenue. When Stripe pays out to Chase, import the deposit on the
          Expenses screen: it files itself to Stripe Undeposited Funds, so the revenue is never counted twice. MRR is the sum of the "Per month" column for contracts still running today.
        </p>
      </div>
    </main>
  );
}
