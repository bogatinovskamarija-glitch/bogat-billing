"use client";

import { useEffect, useState } from "react";

interface PhaseRow {
  id?: string;
  phaseName: string;
  percentOfContract: string;
  status?: string;
}

const BILLING_TYPE_LABEL: Record<string, string> = {
  hourly: "Hourly",
  percentage_phase: "Percentage of contract, per phase",
  fixed_fee: "Fixed fee (lump sum)",
  retainer: "Retainer",
  pro_bono: "Pro bono / speculative",
};

const inputStyle = { padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" };

export default function ProjectBillingSetup({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [billingType, setBillingType] = useState("hourly");
  const [phases, setPhases] = useState<PhaseRow[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/billing`)
      .then((r) => r.json())
      .then((data) => {
        setProjectName(data.project?.name ?? "");
        setBillingType(data.project?.billing_type ?? "hourly");
        setPhases(
          (data.phases || []).map((p: any) => ({
            id: p.id,
            phaseName: p.phase_name,
            percentOfContract: String(p.percent_of_contract),
            status: p.status,
          }))
        );
        setLoading(false);
      });
  }, [projectId]);

  function updatePhase(index: number, field: "phaseName" | "percentOfContract", value: string) {
    setPhases((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addPhase() {
    setPhases((rows) => [...rows, { phaseName: "", percentOfContract: "0" }]);
  }

  function removePhase(index: number) {
    setPhases((rows) => rows.filter((_, i) => i !== index));
  }

  const totalPercent = phases.reduce((s, p) => s + (Number(p.percentOfContract) || 0), 0);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/billing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billingType,
        phases:
          billingType === "percentage_phase"
            ? phases.map((p) => ({ id: p.id, phaseName: p.phaseName, percentOfContract: Number(p.percentOfContract) || 0 }))
            : undefined,
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(21, 27, 20, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20 }}
    >
      <div className="panel" style={{ width: 560, maxHeight: "85vh", overflowY: "auto", padding: 0 }}>
        <div style={{ padding: 20, background: "rgba(59, 82, 55, 0.7)" }}>
          <div className="panel-title" style={{ color: "var(--white)" }}>
            Project Billing Setup — {projectName}
          </div>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? (
            <p style={{ color: "var(--text-dim)" }}>Loading…</p>
          ) : (
            <>
              <label className="label">Billing model</label>
              <select value={billingType} onChange={(e) => setBillingType(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
                {Object.entries(BILLING_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {billingType === "percentage_phase" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label className="label" style={{ marginBottom: 0 }}>
                      Phase breakdown
                    </label>
                    <span style={{ fontSize: 12, color: totalPercent === 100 ? "var(--moss-lite)" : "var(--oxide)" }}>
                      Total: {totalPercent.toFixed(1)}%{totalPercent !== 100 ? " (should be 100%)" : ""}
                    </span>
                  </div>
                  {phases.map((phase, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <input
                        value={phase.phaseName}
                        onChange={(e) => updatePhase(i, "phaseName", e.target.value)}
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder="Phase name"
                        disabled={phase.status === "billed"}
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={phase.percentOfContract}
                        onChange={(e) => updatePhase(i, "percentOfContract", e.target.value)}
                        style={{ ...inputStyle, width: 90 }}
                        disabled={phase.status === "billed"}
                      />
                      <span style={{ fontSize: 12, color: "var(--text-dim)", width: 12 }}>%</span>
                      {phase.status === "billed" ? (
                        <span style={{ fontSize: 11, color: "var(--text-faint)", width: 70 }}>Billed</span>
                      ) : (
                        <button type="button" className="btn-secondary" onClick={() => removePhase(i)} style={{ padding: "4px 10px" }}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-secondary" onClick={addPhase} style={{ marginTop: 4 }}>
                    + Add phase
                  </button>
                </>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button className="btn-secondary" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
