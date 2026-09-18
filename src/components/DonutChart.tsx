"use client";

import { useState } from "react";

export interface DonutDatum {
  label: string;
  value: number;
  // Explicit override for status/semantic charts (e.g. paid/overdue/open),
  // where the color carries fixed meaning rather than arbitrary category
  // identity — falls back to the categorical palette when omitted.
  color?: string;
}

// Fixed-order categorical palette (validated: node validate_palette.js against
// this app's dark floor surface #151b14 — all six checks pass, worst adjacent
// CVD ΔE 8.4). Reserved for multi-category composition charts only — the
// app's moss/moss-lite/oxide stay meaning "primary metric" / "alert"
// elsewhere, never repurposed as a generic series color.
const CATEGORICAL = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
const MAX_SLICES = CATEGORICAL.length;

function formatDefault(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Composition chart (e.g. expense mix, invoice status split) — a donut, not
// a bar, because the job here is "share of a whole," not ranked magnitude.
// Values <= 0 are dropped (a slice can't be negative). More than 6
// categories fold the smallest into "Other" rather than cycling colors.
export default function DonutChart({
  data,
  formatValue = formatDefault,
  centerLabel,
}: {
  data: DonutDatum[];
  formatValue?: (n: number) => string;
  centerLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const positive = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const sliced =
    positive.length > MAX_SLICES
      ? [
          ...positive.slice(0, MAX_SLICES - 1),
          { label: "Other", value: positive.slice(MAX_SLICES - 1).reduce((s, d) => s + d.value, 0) },
        ]
      : positive;

  const total = sliced.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No data yet.</p>;
  }

  const size = 180;
  const radius = size / 2;
  const innerRadius = radius * 0.62;
  const center = size / 2;

  let cumulative = 0;
  const arcs = sliced.map((d, i) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    const ix1 = center + innerRadius * Math.cos(endAngle);
    const iy1 = center + innerRadius * Math.sin(endAngle);
    const ix2 = center + innerRadius * Math.cos(startAngle);
    const iy2 = center + innerRadius * Math.sin(startAngle);

    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
    return { ...d, path, color: d.color ?? CATEGORICAL[i % CATEGORICAL.length], pct: Math.round((d.value / total) * 100) };
  });

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size}>
          {arcs.map((a, i) => (
            <path
              key={a.label}
              d={a.path}
              fill={a.color}
              opacity={hover === null || hover === i ? 1 : 0.4}
              stroke="var(--floor)"
              strokeWidth={2}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          {hover !== null ? (
            <>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{arcs[hover].label}</div>
              <div className="figure" style={{ fontSize: 15, fontWeight: 700, color: "var(--white)" }}>
                {arcs[hover].pct}%
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{centerLabel ?? "Total"}</div>
              <div className="figure" style={{ fontSize: 14, fontWeight: 700, color: "var(--white)" }}>
                {formatValue(total)}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 140 }}>
        {arcs.map((a, i) => (
          <div
            key={a.label}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: hover === null || hover === i ? 1 : 0.5, cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-dim)", flex: 1 }}>{a.label}</span>
            <span className="figure" style={{ color: "var(--text)" }}>
              {formatValue(a.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
