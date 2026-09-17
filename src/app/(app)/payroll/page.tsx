"use client";

import { useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";

interface PayrollPerson {
  name: string;
  role: string;
  basis: string;
  regularHours: number;
  billableHours: number;
  gross: number | null;
}

function currentSemiMonthlyPeriod(): { start: string; end: string; label: string } {
  const now = new Date();
  const day = now.getDate();
  const start = new Date(now.getFullYear(), now.getMonth(), day <= 15 ? 1 : 16);
  const end = day <= 15 ? new Date(now.getFullYear(), now.getMonth(), 15) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { day: "numeric" })}`;
  return { start: fmt(start), end: fmt(end), label };
}

function previousSemiMonthlyPeriod(): { start: string; end: string; label: string } {
  const cur = currentSemiMonthlyPeriod();
  const curStart = new Date(cur.start);
  const prevEnd = new Date(curStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = prevEnd.getDate() > 15 ? new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 16) : new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${prevStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${prevEnd.toLocaleDateString("en-US", { day: "numeric" })}`;
  return { start: fmt(prevStart), end: fmt(prevEnd), label };
}

export default function PayrollPage() {
  const [periodMode, setPeriodMode] = useState<"current" | "previous">("current");
  const [people, setPeople] = useState<PayrollPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => (periodMode === "current" ? currentSemiMonthlyPeriod() : previousSemiMonthlyPeriod()), [periodMode]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/payroll?start=${period.start}&end=${period.end}`)
      .then((r) => r.json())
      .then((data) => setPeople(data.people || []))
      .finally(() => setLoading(false));
  }, [period]);

  const totalHours = people.reduce((s, p) => s + p.regularHours, 0);
  const billableRatio = people.length > 0 && totalHours > 0
    ? Math.round((people.reduce((s, p) => s + p.billableHours, 0) / totalHours) * 100)
    : 0;

  return (
    <main>
      <ScreenHeader
        sheetCode="PPL-06"
        contextLabel="Time tracked in ClickUp"
        title="Payroll"
        actions={
          <>
            <button className={`btn-secondary ${periodMode === "current" ? "active" : ""}`} onClick={() => setPeriodMode("current")}>
              Current
            </button>
            <button className={`btn-secondary ${periodMode === "previous" ? "active" : ""}`} onClick={() => setPeriodMode("previous")}>
              Previous
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Pay period</div>
          <div className="stat-figure" style={{ color: "var(--white)" }}>
            {period.label}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Semi-monthly</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Total hours</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            {totalHours.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{people.length} people</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Billable ratio</div>
          <div className="stat-figure figure" style={{ color: "var(--moss-lite)" }}>
            {billableRatio}%
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Of tracked hours</div>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <p style={{ padding: 20, color: "var(--text-dim)" }}>Loading time entries from ClickUp…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th className="money">Hours</th>
                <th>Basis</th>
                <th className="money">Gross</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.name}>
                  <td>
                    <div className="table-value">{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{p.role}</div>
                  </td>
                  <td className="money table-value figure">{p.regularHours.toFixed(1)}</td>
                  <td style={{ color: "var(--text-dim)" }}>{p.basis}</td>
                  <td className="money table-value figure">{p.gross !== null ? `$${p.gross.toFixed(2)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, marginTop: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-title" style={{ marginBottom: 8 }}>
            What this screen does
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
            Totals ClickUp time entries per person per pay period. Salaried people show a dash rather
            than an invented figure.
          </p>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-title" style={{ marginBottom: 8 }}>
            What it does not do
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
            It does not move money, calculate withholding, or file anything. Reconciliation screen, not
            a bank. There's no team member data or approval workflow yet — solo scope for now.
          </p>
        </div>
      </div>
    </main>
  );
}
