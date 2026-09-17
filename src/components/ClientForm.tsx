"use client";

import { useState } from "react";
import type { Client } from "@/lib/supabase";

export interface ClientFormValues {
  name: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingAddress: string;
  defaultHourlyRate: string;
}

export function emptyClientForm(): ClientFormValues {
  return {
    name: "",
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    billingAddress: "",
    defaultHourlyRate: "",
  };
}

export function clientToForm(c: Client): ClientFormValues {
  return {
    name: c.name,
    companyName: c.company_name ?? "",
    contactName: c.contact_name ?? "",
    contactEmail: c.contact_email ?? "",
    contactPhone: c.contact_phone ?? "",
    billingAddress: c.billing_address ?? "",
    defaultHourlyRate: c.default_hourly_rate?.toString() ?? "",
  };
}

const inputStyle = { padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" };

export default function ClientForm({
  initial,
  editing,
  onSaved,
  onCancel,
}: {
  initial?: ClientFormValues;
  editing?: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ClientFormValues>(initial ?? emptyClientForm());
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      companyName: form.companyName || null,
      contactName: form.contactName || null,
      contactEmail: form.contactEmail || null,
      contactPhone: form.contactPhone || null,
      billingAddress: form.billingAddress || null,
      defaultHourlyRate: form.defaultHourlyRate ? Number(form.defaultHourlyRate) : null,
    };
    if (editing) {
      await fetch(`/api/clients/${editing}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      <div>
        <label className="label">Client name</label>
        <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label className="label">Company name</label>
        <input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label className="label">Default hourly rate</label>
        <input type="number" step="0.01" value={form.defaultHourlyRate} onChange={(e) => setForm((f) => ({ ...f, defaultHourlyRate: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label className="label">Contact name</label>
        <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label className="label">Contact email</label>
        <input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} style={inputStyle} />
      </div>
      <div>
        <label className="label">Contact phone</label>
        <input type="tel" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} style={inputStyle} />
      </div>
      <div style={{ gridColumn: "span 3" }}>
        <label className="label">Billing address</label>
        <input value={form.billingAddress} onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))} style={inputStyle} placeholder="Street, City, State ZIP" />
      </div>
      <div style={{ display: "flex", gap: 8, gridColumn: "span 3" }}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Save client"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
