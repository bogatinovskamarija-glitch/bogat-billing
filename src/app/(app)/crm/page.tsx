"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";
import ContactDrawer from "@/components/ContactDrawer";
import type { CrmContact } from "@/app/api/crm/route";

export default function CrmPage() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState<CrmContact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/crm");
    const data = await res.json();
    setContacts(data.contacts || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/crm/sync", { method: "POST" });
    setSyncing(false);
    await load();
  }

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const strong = contacts.filter((c) => c.tier === "A" && c.strength >= 4).length;
    const overdue = contacts.filter((c) => c.nextTouchDate && c.nextTouchDate < today).length;
    const revenue = contacts.reduce((s, c) => s + (c.totalRevenueLifetime ?? 0), 0);
    return { tracked: contacts.length, strong, overdue, revenue };
  }, [contacts]);

  return (
    <main>
      <ScreenHeader
        sheetCode="CLI-08"
        contextLabel="Relationships on the ClickUp CRM list"
        title="CRM"
        actions={
          <button className="btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync ClickUp"}
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Tracked contacts</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            {stats.tracked}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Strong relationships</div>
          <div className="stat-figure figure" style={{ color: "var(--moss-lite)" }}>
            {stats.strong}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Overdue touches</div>
          <div className="stat-figure figure" style={{ color: stats.overdue > 0 ? "var(--oxide)" : "var(--white)" }}>
            {stats.overdue}
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Client revenue (lifetime)</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 16 }}>
          <span className="badge" style={{ marginRight: 8 }}>A</span>
          <span style={{ fontSize: 13 }}>Active revenue or live deal — touch every 14 days</span>
        </div>
        <div className="panel" style={{ padding: 16 }}>
          <span className="badge" style={{ marginRight: 8 }}>B</span>
          <span style={{ fontSize: 13 }}>Referral and consultant network — touch every 21 days</span>
        </div>
        <div className="panel" style={{ padding: 16 }}>
          <span className="badge" style={{ marginRight: 8 }}>C</span>
          <span style={{ fontSize: 13 }}>Strategic and media — touch every 30 days</span>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <p style={{ padding: 20, color: "var(--text-dim)" }}>Loading contacts from ClickUp…</p>
        ) : contacts.length === 0 ? (
          <p style={{ padding: 20, color: "var(--text-dim)" }}>
            No contacts synced yet — click "Sync ClickUp" above.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Type</th>
                <th>Tier</th>
                <th>Strength</th>
                <th>Last touch</th>
                <th>Next touch</th>
                <th>Referral</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const today = new Date().toISOString().slice(0, 10);
                const overdue = c.nextTouchDate && c.nextTouchDate < today;
                return (
                  <tr key={c.clickupTaskId}>
                    <td>
                      <div className="table-value">{c.primaryContact || c.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.companyName || c.name}</div>
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{c.clientType ?? "—"}</td>
                    <td>{c.tier ? <span className="badge">{c.tier}</span> : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            style={{ width: 12, height: 5, background: n <= c.strength ? "var(--moss-lite)" : "var(--line)" }}
                          />
                        ))}
                      </div>
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{c.lastTouchDate ?? "—"}</td>
                    <td style={{ color: overdue ? "var(--oxide)" : "var(--text-dim)" }}>{c.nextTouchDate ?? "—"}</td>
                    <td>
                      {c.referralPotential ? (
                        <span className="badge" style={c.referralPotential === "High" ? { borderColor: "var(--moss-lite)", color: "var(--moss-lite)" } : {}}>
                          {c.referralPotential}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button className="btn-secondary" onClick={() => setOpen(c)} style={{ padding: "6px 12px" }}>
                        Open
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <ContactDrawer
          contact={open}
          onClose={() => setOpen(null)}
          onSaved={async () => {
            await load();
            setOpen(null);
          }}
        />
      )}
    </main>
  );
}
