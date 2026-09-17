"use client";

import { useState } from "react";

export interface MonthBucket {
  label: string;
  collected: number;
  billedUncollected: number;
}

const COLLECTED_COLOR = "var(--moss-lite)";
const BILLED_COLOR = "var(--moss)";

export default function RevenueChart({ data }: { data: MonthBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.collected + d.billedUncollected));
  const chartHeight = 200;
  const barWidth = 36;
  const gap = 28;

  return (
    <div>
      <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
          <span style={{ width: 10, height: 10, background: COLLECTED_COLOR, display: "inline-block" }} />
          Collected
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
          <span style={{ width: 10, height: 10, background: BILLED_COLOR, display: "inline-block" }} />
          Billed, uncollected
        </div>
      </div>

      <svg width={data.length * (barWidth + gap) + gap} height={chartHeight + 40}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={data.length * (barWidth + gap) + gap}
            y1={chartHeight - chartHeight * f + 10}
            y2={chartHeight - chartHeight * f + 10}
            stroke="var(--line-soft)"
            strokeWidth={1}
          />
        ))}
        {data.map((d, i) => {
          const total = d.collected + d.billedUncollected;
          const collectedH = (d.collected / max) * chartHeight;
          const billedH = (d.billedUncollected / max) * chartHeight;
          const x = gap + i * (barWidth + gap);
          const baseY = chartHeight + 10;
          return (
            <g
              key={d.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: total > 0 ? "pointer" : "default" }}
            >
              {billedH > 0 && (
                <rect
                  x={x}
                  y={baseY - collectedH - billedH}
                  width={barWidth}
                  height={billedH}
                  fill={BILLED_COLOR}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {collectedH > 0 && (
                <rect
                  x={x}
                  y={baseY - collectedH}
                  width={barWidth}
                  height={collectedH}
                  fill={COLLECTED_COLOR}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  rx={2}
                />
              )}
              {total === 0 && <rect x={x} y={baseY - 2} width={barWidth} height={2} fill="var(--line)" />}
              <text x={x + barWidth / 2} y={chartHeight + 30} textAnchor="middle" fontSize={12} fill="var(--text-dim)">
                {d.label}
              </text>
              {hover === i && total > 0 && (
                <g>
                  <rect
                    x={x - 30}
                    y={baseY - collectedH - billedH - 46}
                    width={140}
                    height={36}
                    fill="var(--forest)"
                    stroke="var(--line)"
                  />
                  <text x={x - 22} y={baseY - collectedH - billedH - 30} fontSize={11} fill="var(--text)">
                    Collected ${d.collected.toLocaleString()}
                  </text>
                  <text x={x - 22} y={baseY - collectedH - billedH - 16} fontSize={11} fill="var(--text)">
                    Billed ${d.billedUncollected.toLocaleString()}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
