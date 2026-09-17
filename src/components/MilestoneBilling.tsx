"use client";

import type { MilestoneProject, MilestonePhase } from "@/lib/billing-candidates";

// Canonical phase order, used only to suggest (never auto-set) which phases
// look ready given ClickUp's Current Phase — a project's own phase table can
// use entirely different names, so this is a best-effort hint, not a rule.
const CANONICAL_ORDER = [
  "pre-design",
  "schematic design",
  "design development",
  "construction documents",
  "permitting",
  "bidding",
  "construction administration",
];

function looksReady(phaseName: string, currentPhase: string | null): boolean {
  if (!currentPhase) return false;
  const phaseIdx = CANONICAL_ORDER.indexOf(phaseName.trim().toLowerCase());
  const currentIdx = CANONICAL_ORDER.indexOf(currentPhase.trim().toLowerCase());
  return phaseIdx !== -1 && currentIdx !== -1 && phaseIdx <= currentIdx;
}

export default function MilestoneBilling({
  projects,
  selected,
  onToggleSelected,
  onToggleReady,
  onEditProject,
}: {
  projects: MilestoneProject[];
  selected: Record<string, boolean>;
  onToggleSelected: (phaseId: string, checked: boolean) => void;
  onToggleReady: (phase: MilestonePhase, ready: boolean) => void;
  onEditProject: (projectId: string) => void;
}) {
  if (projects.length === 0) return null;

  return (
    <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
      <div style={{ padding: 20, background: "var(--raised)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--white)" }}>Milestone Billing</div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4, marginBottom: 0 }}>
          Projects billed by contract percentage per design phase, not by the hour.
        </p>
      </div>

      {projects.map((project) => (
        <div key={project.projectId} style={{ padding: 20, borderTop: "1px solid var(--line-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--white)" }}>{project.projectName}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {project.clientName} · Contract ${project.contractValue.toFixed(2)}
                {project.currentPhase && <> · Current phase: {project.currentPhase}</>}
              </div>
            </div>
            <button className="btn-secondary" onClick={() => onEditProject(project.projectId)} style={{ padding: "6px 12px" }}>
              Edit phases
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th>Phase</th>
                <th className="money">% of contract</th>
                <th className="money">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {project.phases.map((phase) => {
                const suggested = looksReady(phase.phase_name, project.currentPhase) && phase.status === "not_started";
                return (
                  <tr key={phase.id}>
                    <td>
                      <input
                        type="checkbox"
                        disabled={phase.status !== "ready_to_bill"}
                        checked={!!selected[phase.id]}
                        onChange={(e) => onToggleSelected(phase.id, e.target.checked)}
                      />
                    </td>
                    <td className="table-value">
                      {phase.phase_name}
                      {suggested && (
                        <span style={{ fontSize: 11, color: "var(--moss-lite)", marginLeft: 8 }}>
                          Current phase has reached this point
                        </span>
                      )}
                    </td>
                    <td className="money table-value figure">{Number(phase.percent_of_contract).toFixed(1)}%</td>
                    <td className="money table-value figure">${phase.amount.toFixed(2)}</td>
                    <td>
                      {phase.status === "billed" ? (
                        <span className="badge" style={{ borderColor: "var(--moss-lite)", color: "var(--moss-lite)" }}>
                          Billed
                        </span>
                      ) : phase.status === "ready_to_bill" ? (
                        <span className="badge" style={{ borderColor: "var(--moss-lite)", color: "var(--moss-lite)" }}>
                          Ready to Bill
                        </span>
                      ) : (
                        <span className="badge">Not Started</span>
                      )}
                    </td>
                    <td>
                      {phase.status === "not_started" && (
                        <button className="btn-secondary" onClick={() => onToggleReady(phase, true)} style={{ padding: "6px 12px" }}>
                          Mark ready to bill
                        </button>
                      )}
                      {phase.status === "ready_to_bill" && (
                        <button className="btn-secondary" onClick={() => onToggleReady(phase, false)} style={{ padding: "6px 12px" }}>
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
