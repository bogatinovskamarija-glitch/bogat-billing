"use client";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

// Horizontal bar breakdown — used wherever we need a "by X" chart (client,
// category, pipeline stage) where X is a named, variable-length label.
// Vertical bars work well for RevenueChart's fixed short month labels, but
// named categories read far better as a ranked horizontal list.
export default function BarChart({
  data,
  color = "var(--moss-lite)",
  formatValue = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  emptyLabel = "No data yet.",
}: {
  data: BarDatum[];
  color?: string;
  formatValue?: (n: number) => string;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-faint)" }}>{emptyLabel}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      {data.map((d) => (
        <div key={d.label} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
            <span>
              {d.label}
              {d.sublabel && <span style={{ color: "var(--text-faint)" }}> · {d.sublabel}</span>}
            </span>
            <span className="figure" style={{ color: "var(--text)" }}>
              {formatValue(d.value)}
            </span>
          </div>
          <div style={{ height: 8, background: "var(--line)", width: "100%" }}>
            <div style={{ height: 8, background: d.color ?? color, width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
