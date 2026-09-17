"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UnassignedProject {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

export default function SyncAndAssignPanel({
  unassignedProjects,
  clients,
}: {
  unassignedProjects: UnassignedProject[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [creating, setCreating] = useState(false);
  const [assignPicks, setAssignPicks] = useState<Record<string, string>>({});

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/sync/projects", { method: "POST" });
    setSyncing(false);
    router.refresh();
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setCreating(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName.trim() }),
    });
    setNewClientName("");
    setCreating(false);
    router.refresh();
  }

  async function handleAssign(projectId: string) {
    const clientId = assignPicks[projectId];
    if (!clientId) return;
    await fetch(`/api/projects/${projectId}/assign-client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    router.refresh();
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <button className="btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync projects from ClickUp"}
        </button>

        <form onSubmit={handleCreateClient} style={{ display: "flex", gap: 6 }}>
          <input
            placeholder="New client name"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            style={{ padding: 8, border: "1px solid var(--brand-stone)", borderRadius: 4 }}
          />
          <button type="submit" disabled={creating} style={{ padding: "8px 14px", borderRadius: 4, border: "1px solid var(--brand-stone)", background: "white" }}>
            + New client
          </button>
        </form>
      </div>

      {unassignedProjects.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "0.95rem", color: "var(--brand-primary)", marginBottom: 12 }}>
            Unassigned projects
          </h2>
          <p style={{ fontSize: "0.8rem", color: "#777", marginBottom: 12 }}>
            These synced from ClickUp but have no Client set yet — assign one to review their billable work.
          </p>
          {unassignedProjects.map((project) => (
            <div key={project.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1 }}>{project.name}</span>
              <select
                value={assignPicks[project.id] ?? ""}
                onChange={(e) => setAssignPicks((p) => ({ ...p, [project.id]: e.target.value }))}
                style={{ padding: 6, border: "1px solid var(--brand-stone)", borderRadius: 4 }}
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleAssign(project.id)}
                disabled={!assignPicks[project.id]}
                style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid var(--brand-stone)", background: "white" }}
              >
                Assign
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
