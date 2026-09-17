"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CandidateProject } from "@/app/api/billing-review/[clientId]/route";

export default function ClientBillingReviewPage({ params }: { params: { clientId: string } }) {
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [projects, setProjects] = useState<CandidateProject[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/billing-review/${params.clientId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setClient(data.client);
        setProjects(data.projects);
        const initialSelected: Record<string, boolean> = {};
        const initialAmounts: Record<string, number> = {};
        for (const project of data.projects as CandidateProject[]) {
          for (const task of project.tasks) {
            initialSelected[task.clickupTaskId] = true;
            initialAmounts[task.clickupTaskId] = task.amount;
          }
        }
        setSelected(initialSelected);
        setAmounts(initialAmounts);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [params.clientId]);

  const total = useMemo(() => {
    return Object.entries(amounts).reduce((sum, [taskId, amount]) => (selected[taskId] ? sum + amount : sum), 0);
  }, [amounts, selected]);

  const includedCount = Object.values(selected).filter(Boolean).length;

  if (loading) return <main style={{ padding: 40 }}>Loading candidates from ClickUp…</main>;
  if (error) return <main style={{ padding: 40 }}>Error: {error}</main>;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px" }}>
      <Link href="/billing-review" style={{ fontSize: "0.85rem" }}>
        ← All clients
      </Link>
      <h1 style={{ color: "var(--brand-primary)", fontWeight: 600, margin: "8px 0 24px" }}>
        {client?.name} — Billing Review
      </h1>

      {projects.length === 0 ? (
        <div className="card">
          <p>No tasks at status "bill" awaiting invoicing for this client right now.</p>
        </div>
      ) : (
        <>
          {projects.map((project) => (
            <div key={project.projectId} className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: "1rem", color: "var(--brand-primary)", marginBottom: 4 }}>
                {project.projectName}
              </h2>
              {project.currentPhase && (
                <p style={{ fontSize: "0.8rem", color: "#777", marginBottom: 12 }}>{project.currentPhase}</p>
              )}
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>Task</th>
                    <th>Progress notes</th>
                    <th>Hours</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map((task) => (
                    <tr key={task.clickupTaskId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected[task.clickupTaskId] ?? true}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [task.clickupTaskId]: e.target.checked }))
                          }
                        />
                      </td>
                      <td>{task.taskName}</td>
                      <td style={{ whiteSpace: "pre-line", fontSize: "0.85rem", color: "#555" }}>
                        {task.progressNarrative || "—"}
                      </td>
                      <td>{task.hours}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={amounts[task.clickupTaskId] ?? task.amount}
                          onChange={(e) =>
                            setAmounts((a) => ({ ...a, [task.clickupTaskId]: parseFloat(e.target.value) || 0 }))
                          }
                          style={{ width: 90, padding: 4, border: "1px solid var(--brand-stone)", borderRadius: 4 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div
            className="card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              bottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", color: "#777" }}>{includedCount} tasks included</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "var(--brand-primary)" }}>
                ${total.toFixed(2)}
              </div>
            </div>
            <button className="btn-primary" disabled title="Invoice generation lands in Phase B">
              Generate Invoice
            </button>
          </div>
        </>
      )}
    </main>
  );
}
