"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "../../../components/ScreenHeader";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Bill {
  id: string;
  vendor_name: string;
  description: string | null;
  bill_date: string;
  due_date: string | null;
  amount: number;
  status: "unpaid" | "paid";
  paid_date: string | null;
  accounts: { code: string; name: string } | null;
}

function isOverdue(bill: Bill): boolean {
  return bill.status === "unpaid" && !!bill.due_date && bill.due_date < new Date().toISOString().slice(0, 10);
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendorName: "",
    description: "",
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amount: "",
    accountId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [billsRes, acctRes] = await Promise.all([
      fetch("/api/bills").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]);
    setBills(billsRes.bills || []);
    setAccounts((acctRes.accounts || []).filter((a: AccountOption) => a.type === "expense"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.vendorName || !form.billDate || !form.amount || !form.accountId) return;
    setSaving(true);
    await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorName: form.vendorName,
        description: form.description || undefined,
        billDate: form.billDate,
        dueDate: form.dueDate || undefined,
        amount: Number(form.amount),
        accountId: form.accountId,
      }),
    });
    setSaving(false);
    setForm({ vendorName: "", description: "", billDate: new Date().toISOString().slice(0, 10), dueDate: "", amount: "", accountId: "" });
    setShowAddForm(false);
    await load();
  }

  async function handleMarkPaid(id: string) {
    if (!confirm("Mark this bill as paid? This posts a payment entry (Dr Accounts Payable / Cr Cash) dated today.")) return;
    await fetch(`/api/bills/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this bill? This reverses the accrual entry too.")) return;
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    await load();
  }

  const unpaid = bills.filter((b) => b.status === "unpaid");
  const paid = bills.filter((b) => b.status === "paid");
  const totalUnpaid = unpaid.reduce((s, b) => s + Number(b.amount), 0);
  const overdueCount = unpaid.filter(isOverdue).length;

  return (
    <main>
      <ScreenHeader
        sheetCode="EXP-09"
        contextLabel="Bills owed but not yet paid"
        title="Bills"
        actions={
          <button className="btn-secondary" onClick={() => setShowAddForm((s) => !s)}>
            {showAddForm ? "Cancel" : "+ Add bill"}
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-group)", marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Total unpaid</div>
          <div className="hero-figure figure" style={{ color: "var(--white)" }}>
            ${totalUnpaid.toFixed(2)}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Overdue</div>
          <div className="hero-figure figure" style={{ color: overdueCount > 0 ? "var(--oxide)" : "var(--white)" }}>
            {overdueCount}
          </div>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="panel"
          style={{ padding: 20, marginBottom: "var(--space-group)", display: "grid", gridTemplateColumns: "1fr 1fr 130px 130px 120px 1fr auto", gap: 12, alignItems: "end" }}
        >
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Vendor</label>
            <input
              required
              value={form.vendorName}
              onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
              style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
            />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
            />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Bill date</label>
            <input
              type="date"
              required
              value={form.billDate}
              onChange={(e) => setForm((f) => ({ ...f, billDate: e.target.value }))}
              style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
            />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Due date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
            />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Amount</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
            />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6 }}>Category</label>
            <select
              required
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
            <div className="panel-title" style={{ padding: "16px 20px 0" }}>
              Unpaid ({unpaid.length})
            </div>
            {unpaid.length === 0 ? (
              <p style={{ padding: 20, color: "var(--text-dim)" }}>Nothing owed right now.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Bill date</th>
                    <th>Due date</th>
                    <th className="money">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {unpaid.map((b) => (
                    <tr key={b.id}>
                      <td className="table-value">
                        {b.vendor_name}
                        {b.description && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{b.description}</div>}
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{b.accounts?.name ?? "—"}</td>
                      <td style={{ color: "var(--text-dim)" }}>{b.bill_date}</td>
                      <td style={{ color: isOverdue(b) ? "var(--oxide)" : "var(--text-dim)" }}>
                        {b.due_date ?? "—"}
                        {isOverdue(b) && " · overdue"}
                      </td>
                      <td className="money table-value figure">${Number(b.amount).toFixed(2)}</td>
                      <td style={{ display: "flex", gap: 8 }}>
                        <button className="btn-secondary" onClick={() => handleMarkPaid(b.id)} style={{ padding: "6px 12px" }}>
                          Mark paid
                        </button>
                        <button className="btn-secondary" onClick={() => handleDelete(b.id)} style={{ padding: "6px 12px" }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-title" style={{ padding: "16px 20px 0" }}>
              Paid ({paid.length})
            </div>
            {paid.length === 0 ? (
              <p style={{ padding: 20, color: "var(--text-dim)" }}>No bills paid yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Paid date</th>
                    <th className="money">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.map((b) => (
                    <tr key={b.id}>
                      <td className="table-value">{b.vendor_name}</td>
                      <td style={{ color: "var(--text-dim)" }}>{b.accounts?.name ?? "—"}</td>
                      <td style={{ color: "var(--text-dim)" }}>{b.paid_date}</td>
                      <td className="money table-value figure">${Number(b.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
