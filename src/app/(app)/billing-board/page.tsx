"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ScreenHeader from "@/components/ScreenHeader";
import type { CandidateClient, BoardTab } from "@/lib/billing-candidates";

interface UnassignedProject {
  id: string;
  name: string;
}
interface ClientOption {
  id: string;
  name: string;
}

export default function BillingBoardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<BoardTab>("ready");
  const [clients, setClients] = useState<CandidateClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [unassignedProjects, setUnassignedProjects] = useState<UnassignedProject[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [assignPicks, setAssignPicks] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadBoard = useCallback(async (activeTab: BoardTab) => {
    setLoading(true);
    const res = await fetch(`/api/billing-board?tab=${activeTab}`);
    const data = await res.json();
    setClients(data.clients || []);
    const initialSelected: Record<string, boolean> = {};
    (data.clients || []).forEach((c: CandidateClient) =>
      c.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (t.billingStatus === "ready_to_invoice") initialSelected[t.clickupTaskId] = true;
        })
      )
    );
    setSelected(initialSelected);
    setLoading(false);
  }, []);

  const loadAssignmentData = useCallback(async () => {
    const [clientsRes, projectsRes] = await Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/unassigned-projects").then((r) => r.json()),
    ]);
    setClientOptions(clientsRes.clients || []);
    setUnassignedProjects(projectsRes.projects || []);
  }, []);

  useEffect(() => {
    loadBoard(tab);
  }, [tab, loadBoard]);

  useEffect(() => {
    loadAssignmentData();
  }, [loadAssignmentData]);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/sync/projects", { method: "POST" });
    setSyncing(false);
    await Promise.all([loadBoard(tab), loadAssignmentData()]);
    router.refresh();
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName.trim() }),
    });
    setNewClientName("");
    await loadAssignmentData();
  }

  async function handleAssign(projectId: string) {
    const clientId = assignPicks[projectId];
    if (!clientId) return;
    await fetch(`/api/projects/${projectId}/assign-client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    await Promise.all([loadAssignmentData(), loadBoard(tab)]);
  }

  const selectedInfo = useMemo(() => {
    let total = 0;
    let taskCount = 0;
    const clientIds = new Set<string>();
    clients.forEach((c) =>
      c.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (selected[t.clickupTaskId] && t.billingStatus !== "invoiced") {
            total += t.amount;
            taskCount += 1;
            clientIds.add(c.clientId);
          }
        })
      )
    );
    return { total: Math.round(total * 100) / 100, taskCount, clientCount: clientIds.size };
  }, [clients, selected]);

  const selections = useMemo(() => {
    return clients
      .map((c) => {
        const items: any[] = [];
        c.projects.forEach((p) =>
          p.tasks.forEach((t) => {
            if (selected[t.clickupTaskId] && t.billingStatus !== "invoiced") {
              items.push({
                clickupTaskId: t.clickupTaskId,
                clickupListId: t.clickupListId,
                projectId: t.projectId,
                taskName: t.taskName,
                phase: t.phase,
                closedDate: t.closedDate,
                hours: t.hours,
                hourlyRate: t.hourlyRate,
                amount: t.amount,
                progressNarrative: t.progressNarrative,
              });
            }
          })
        );
        return { clientId: c.clientId, clientName: c.clientName, items, total: items.reduce((s, i) => s + i.amount, 0) };
      })
      .filter((s) => s.items.length > 0);
  }, [clients, selected]);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections: selections.map(({ clientId, items }) => ({ clientId, items })) }),
    });
    const data = await res.json();
    setGenerating(false);
    setConfirmOpen(false);
    if (data.created?.length) {
      router.push("/invoices");
    } else {
      await loadBoard(tab);
    }
  }

  function toggleGroup(client: CandidateClient, checked: boolean) {
    setSelected((s) => {
      const next = { ...s };
      client.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (t.billingStatus !== "invoiced") next[t.clickupTaskId] = checked;
        })
      );
      return next;
    });
  }

  return (
    <main>
      <ScreenHeader
        sheetCode="REV-05"
        contextLabel="Completed billable work"
        title="Billing Board"
        actions={
          <>
            {(["ready", "unbilled", "all"] as BoardTab[]).map((t) => (
              <button
                key={t}
                className={`btn-secondary ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "ready" ? "Ready" : t === "unbilled" ? "Unbilled" : "All"}
              </button>
            ))}
            <button className="btn-secondary" onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync ClickUp"}
            </button>
          </>
        }
      />

      {unassignedProjects.length > 0 && (
        <div className="panel" style={{ padding: 20, marginBottom: "var(--space-group)" }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>
            Unassigned projects
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0, marginBottom: 16 }}>
            Synced from ClickUp but no Client set yet.
          </p>
          {unassignedProjects.map((project) => (
            <div key={project.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 14 }}>{project.name}</span>
              <select
                value={assignPicks[project.id] ?? ""}
                onChange={(e) => setAssignPicks((p) => ({ ...p, [project.id]: e.target.value }))}
                style={{
                  padding: 8,
                  background: "var(--floor)",
                  color: "var(--text)",
                  border: "1px solid var(--line)",
                }}
              >
                <option value="">Select client…</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" onClick={() => handleAssign(project.id)} disabled={!assignPicks[project.id]}>
                Assign
              </button>
            </div>
          ))}
          <form onSubmit={handleCreateClient} style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <input
              placeholder="New client name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", flex: 1 }}
            />
            <button type="submit" className="btn-secondary">
              + New client
            </button>
          </form>
        </div>
      )}

      <div
        className="panel"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 20,
          marginBottom: "var(--space-group)",
          background: "rgba(59, 82, 55, 0.62)",
          borderColor: "var(--canopy-lt)",
          position: "sticky",
          top: 20,
          zIndex: 5,
        }}
      >
        <div>
          <div className="panel-title" style={{ color: "var(--text-dim)" }}>
            Selected for batch
          </div>
          <div className="stat-figure figure" style={{ color: "var(--white)" }}>
            ${selectedInfo.total.toFixed(2)}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {selectedInfo.clientCount} clients · {selectedInfo.taskCount} tasks
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={selectedInfo.clientCount === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Generate {selectedInfo.clientCount || ""} Invoice{selectedInfo.clientCount === 1 ? "" : "s"}
        </button>
      </div>

      {confirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(21, 27, 20, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
          }}
        >
          <div className="panel" style={{ width: 440, padding: 0 }}>
            <div style={{ padding: 20, background: "rgba(59, 82, 55, 0.7)" }}>
              <div className="panel-title" style={{ color: "var(--white)" }}>
                Generate invoices
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 0 }}>
                This creates one invoice per client below. Nothing is written until you confirm.
              </p>
              {selections.map((s) => (
                <div
                  key={s.clientId}
                  style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}
                >
                  <span style={{ fontSize: 14 }}>{s.clientName}</span>
                  <span className="table-value figure">${s.total.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                <button className="btn-secondary" onClick={() => setConfirmOpen(false)} disabled={generating}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
                  {generating ? "Generating…" : "Confirm & Generate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading candidates from ClickUp…</p>
      ) : clients.length === 0 ? (
        <div className="panel" style={{ padding: 20 }}>
          <p style={{ color: "var(--text-dim)", margin: 0 }}>
            Nothing here for this tab right now. Completed tasks arrive from ClickUp with their Billing
            Status — everything accumulated for a client batches into one invoice, never one per task.
          </p>
        </div>
      ) : (
        clients.map((client) => {
          const isCollapsed = collapsed[client.clientId];
          const allSelected = client.projects.every((p) =>
            p.tasks.every((t) => t.billingStatus === "invoiced" || selected[t.clickupTaskId])
          );
          return (
            <div key={client.clientId} className="panel" style={{ marginBottom: "var(--space-group)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 20,
                  background: "var(--raised)",
                  cursor: "pointer",
                }}
                onClick={() => setCollapsed((c) => ({ ...c, [client.clientId]: !c[client.clientId] }))}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => toggleGroup(client, e.target.checked)}
                  />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--white)" }}>{client.clientName}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ textAlign: "right" }}>
                    <div className="label">Accumulated</div>
                    <div className="stat-figure figure">${client.accumulatedTotal.toFixed(2)}</div>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{client.taskCount} tasks</span>
                  <span style={{ color: "var(--text-dim)" }}>{isCollapsed ? "▸" : "▾"}</span>
                </div>
              </div>

              {!isCollapsed &&
                client.projects.map((project) => (
                  <table key={project.projectId}>
                    <thead>
                      <tr>
                        <th style={{ width: 28 }}></th>
                        <th>Task</th>
                        <th>Task ID</th>
                        <th>Closed</th>
                        <th className="money">Hours</th>
                        <th className="money">Rate</th>
                        <th className="money">Amount</th>
                        <th>Billing Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.tasks.map((task) => (
                        <tr key={task.clickupTaskId}>
                          <td>
                            <input
                              type="checkbox"
                              disabled={task.billingStatus === "invoiced"}
                              checked={!!selected[task.clickupTaskId]}
                              onChange={(e) =>
                                setSelected((s) => ({ ...s, [task.clickupTaskId]: e.target.checked }))
                              }
                            />
                          </td>
                          <td className="table-value">
                            {task.taskName}
                            {task.progressNarrative && (
                              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2, whiteSpace: "pre-line" }}>
                                {task.progressNarrative}
                              </div>
                            )}
                          </td>
                          <td style={{ color: "var(--text-dim)" }}>{task.taskCustomId ?? "—"}</td>
                          <td style={{ color: "var(--text-dim)" }}>
                            {task.closedDate ? new Date(Number(task.closedDate)).toLocaleDateString() : "—"}
                          </td>
                          <td className="money table-value figure">{task.hours.toFixed(1)}</td>
                          <td className="money table-value figure">${task.hourlyRate.toFixed(0)}</td>
                          <td className="money table-value figure">${task.amount.toFixed(2)}</td>
                          <td>
                            {task.billingStatus === "invoiced" ? (
                              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{task.invoiceNumber}</span>
                            ) : (
                              <span
                                className="badge"
                                style={
                                  task.billingStatus === "ready_to_invoice"
                                    ? { borderColor: "var(--moss-lite)", color: "var(--moss-lite)" }
                                    : {}
                                }
                              >
                                {task.billingStatus === "ready_to_invoice" ? "Ready to Invoice" : "Not Billed"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
            </div>
          );
        })
      )}
    </main>
  );
}
