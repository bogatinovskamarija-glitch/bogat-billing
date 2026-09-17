"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceActions({ invoiceId, status, balanceDue }: { invoiceId: string; status: string; balanceDue: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [showPayment, setShowPayment] = useState(false);
  const [saving, setSaving] = useState(false);

  async function markSent() {
    setSaving(true);
    await fetch(`/api/invoices/${invoiceId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "sent" }),
    });
    setSaving(false);
    router.refresh();
  }

  async function recordPayment() {
    setSaving(true);
    await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), paidDate: new Date().toISOString().slice(0, 10) }),
    });
    setSaving(false);
    setShowPayment(false);
    router.refresh();
  }

  if (status === "paid") return null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {status === "draft" && (
        <button className="btn-secondary" onClick={markSent} disabled={saving}>
          Mark Sent
        </button>
      )}
      {!showPayment ? (
        <button className="btn-secondary" onClick={() => setShowPayment(true)}>
          Record Payment
        </button>
      ) : (
        <>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 90, padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }}
          />
          <button className="btn-primary" onClick={recordPayment} disabled={saving}>
            {saving ? "Saving…" : "Confirm"}
          </button>
        </>
      )}
    </div>
  );
}
