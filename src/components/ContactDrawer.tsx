"use client";

import { useState } from "react";
import type { CrmContact } from "../app/api/crm/route";

export default function ContactDrawer({
  contact,
  onClose,
  onSaved,
}: {
  contact: CrmContact;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tier, setTier] = useState(contact.tier ?? "");
  const [strength, setStrength] = useState(contact.strength);
  const [referral, setReferral] = useState(contact.referralPotential ?? "");
  const [note, setNote] = useState(contact.workingNote ?? "");
  const [saving, setSaving] = useState(false);

  async function save(extra?: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/crm/${contact.clickupTaskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: tier || null,
        strength,
        referralPotential: referral || null,
        workingNote: note || null,
        ...extra,
      }),
    });
    setSaving(false);
    onSaved();
  }

  const daysSinceTouch = contact.lastTouchDate
    ? Math.floor((Date.now() - new Date(contact.lastTouchDate).getTime()) / 86400000)
    : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(21,27,20,0.6)" }} onClick={onClose} />
      <div
        className="panel"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 380,
          borderRadius: 0,
          overflowY: "auto",
        }}
      >
        <div style={{ padding: 24, background: "rgba(59, 82, 55, 0.75)" }}>
          <div className="label" style={{ marginBottom: 6 }}>
            {contact.clientType ?? "Contact"} {contact.tier && `· Tier ${contact.tier}`}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--white)" }}>{contact.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {contact.primaryContact} {contact.companyName && `· ${contact.companyName}`}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div className="label" style={{ marginBottom: 8 }}>
            Relationship strength
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setStrength(n)}
                style={{
                  width: 32,
                  height: 8,
                  border: "1px solid var(--line)",
                  background: n <= strength ? "var(--moss-lite)" : "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <div className="label" style={{ marginBottom: 6 }}>
            Working note
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              background: "var(--floor)",
              color: "var(--text)",
              border: "1px solid var(--line)",
              marginBottom: 20,
              resize: "vertical",
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Last touch
              </div>
              <div style={{ fontSize: 13 }}>
                {contact.lastTouchDate ?? "—"} {daysSinceTouch !== null && `· ${daysSinceTouch}d ago`}
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Next touch
              </div>
              <div style={{ fontSize: 13 }}>{contact.nextTouchDate ?? "—"}</div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Tier
              </div>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                style={{ padding: 6, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
              >
                <option value="">—</option>
                <option value="A">A — every 14 days</option>
                <option value="B">B — every 21 days</option>
                <option value="C">C — every 30 days</option>
              </select>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>
                Referral potential
              </div>
              <select
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                style={{ padding: 6, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
              >
                <option value="">—</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={() => save({ logTouch: true })} disabled={saving}>
              Log a touch
            </button>
            <button className="btn-secondary" onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
