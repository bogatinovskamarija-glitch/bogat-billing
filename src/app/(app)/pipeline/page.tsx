"use client";

import { useEffect, useMemo, useState } from "react";
import ScreenHeader from "../../../components/ScreenHeader";
import BarChart from "../../../components/BarChart";
import DonutChart from "../../../components/DonutChart";
import type { Deal, Stage } from "../../../app/api/pipeline/route";

const STAGES: { key: Stage; label: string; probability: number }[] = [
  { key: "lead", label: "Lead", probability: 0.1 },
  { key: "qualified", label: "Qualified", probability: 0.3 },
  { key: "proposal_sent", label: "Proposal Sent", probability: 0.55 },
  { key: "won", label: "Won", probability: 1 },
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then((data) => setDeals(data.deals || []))
      .finally(() => setLoading(false));
  }, []);

  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const outliers = deals.filter((d) => d.isOutlier);

  const stats = useMemo(() => {
    const openValue = open.reduce((s, d) => s + d.value, 0);
    const weighted = open.reduce((s, d) => s + d.value * (STAGES.find((st) => st.key === d.stage)?.probability ?? 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const wonThisMonth = deals.filter((d) => d.stage === "won"); // date_updated not tracked here; shows all won
    const wonValue = wonThisMonth.reduce((s, d) => s + d.value, 0);
    const avgDeal = deals.length > 0 ? deals.reduce((s, d) => s + d.value, 0) / deals.length : 0;
    return { openValue, weighted, wonValue, wonCount: wonThisMonth.length, avgDeal };
  }, [deals, open]);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    open.forEach((d) => {
      const key = d.leadSource ?? "Unknown source";
      map.set(key, (map.get(key) ?? 0) + d.value);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [open]);

  const byStage = useMemo(
    () =>
      STAGES.filter((s) => s.key !== "won")
        .map((s) => ({ label: s.label, value: open.filter((d) => d.stage === s.key).reduce((sum, d) => sum + d.value, 0) }))
        .filter((d) => d.value > 0),
    [open]
  );

  return (
    <main>
      <ScreenHeader sheetCode="CLI-09" contextLabel="Deals on the ClickUp Leads list" title="Pipeline" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, marginBottom: "var(--space-group)" }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Open pipeline</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${stats.openValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{open.length} live deals</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Weighted value</div>
          <div className="stat-figure figure" style={{ color: "var(--moss-lite)" }}>
            ${stats.weighted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Probability adjusted</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Won</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${stats.wonValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{stats.wonCount} signed</div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="label">Avg. deal size</div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${stats.avgDeal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {outliers.length > 0 && (
        <div className="panel" style={{ padding: 16, marginBottom: "var(--space-group)", borderColor: "var(--oxide)" }}>
          <span style={{ color: "var(--oxide)", fontWeight: 700 }}>⚠ {outliers.length} outlier deal{outliers.length === 1 ? "" : "s"} flagged: </span>
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {outliers.map((d) => `${d.companyName} ($${d.value.toLocaleString()})`).join(", ")} — value is far above the rest of
            the pipeline. Worth double-checking the Estimated Budget field on that deal in ClickUp; it's included in
            the totals above as-is.
          </span>
        </div>
      )}

      {!loading && (bySource.length > 0 || byStage.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: byStage.length > 0 ? "1fr 1fr" : "1fr", gap: "var(--space-group)", marginBottom: "var(--space-group)" }}>
          {bySource.length > 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <div className="panel-title" style={{ marginBottom: 14 }}>
                Open pipeline by lead source
              </div>
              <BarChart data={bySource} />
            </div>
          )}
          {byStage.length > 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <div className="panel-title" style={{ marginBottom: 14 }}>
                Open pipeline by stage
              </div>
              <DonutChart data={byStage} centerLabel="Open" />
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading deals from ClickUp…</p>
      ) : (
        <div style={{ display: "flex", gap: 1 }}>
          {STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage.key);
            const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
            return (
              <div key={stage.key} style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="panel"
                  style={{
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    background: stage.key === "won" ? "var(--moss-lite)" : "var(--raised)",
                    color: stage.key === "won" ? "var(--floor)" : "var(--text)",
                  }}
                >
                  <span className="label" style={{ color: "inherit" }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: 12 }}>{Math.round(stage.probability * 100)}%</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 4px" }}>
                  ${stageValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {stageDeals.length}
                </div>
                {stageDeals.map((d) => (
                  <div key={d.clickupTaskId} className="panel" style={{ padding: 12, marginBottom: 4, borderColor: d.isOutlier ? "var(--oxide)" : undefined }}>
                    <div className="table-value" style={{ marginBottom: 4 }}>
                      {d.isOutlier && <span title="Value far above the rest of the pipeline — worth double-checking in ClickUp">⚠ </span>}
                      {d.companyName}
                    </div>
                    <div style={{ fontSize: 12, color: d.isOutlier ? "var(--oxide)" : "var(--text-dim)", marginBottom: 6 }}>
                      ${d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {d.leadSource && (
                        <span className="badge" style={{ fontSize: 9 }}>
                          {d.leadSource}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: d.daysInStage > 20 ? "var(--oxide)" : "var(--text-faint)" }}>
                        {d.daysInStage}d in stage
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
