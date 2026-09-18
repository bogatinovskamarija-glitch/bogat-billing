"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ScreenHeader from "../../../components/ScreenHeader";
import type { CandidateClient, BoardTab, MilestoneProject, MilestonePhase } from "../../../lib/billing-candidates";
import type { Client } from "../../../lib/supabase";
import ClientForm, { clientToForm, emptyClientForm, ClientFormValues } from "../../../components/ClientForm";
import MilestoneBilling from "../../../components/MilestoneBilling";
import ProjectBillingSetup from "../../../components/ProjectBillingSetup";
import BarChart from "../../../components/BarChart";

interface UnassignedProject {
  id: string;
  name: string;
}

interface ProjectListRow {
  id: string;
  name: string;
  billing_type: string;
  contract_value: number | null;
  project_type: string | null;
  start_date: string | null;
  projected_end_date: string | null;
  clients: { name: string } | null;
}

interface UnlinkedCrmContact {
  clickupTaskId: string;
  name: string;
  companyName: string | null;
  primaryContact: string | null;
}

const BILLING_TYPE_LABEL: Record<string, string> = {
  hourly: "Hourly",
  percentage_phase: "% per phase",
  fixed_fee: "Fixed fee",
  retainer: "Retainer",
  pro_bono: "Pro bono",
};

export default function BillingBoardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<BoardTab>("ready");
  const [clients, setClients] = useState<CandidateClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [unassignedProjects, setUnassignedProjects] = useState<UnassignedProject[]>([]);
  const [clientOptions, setClientOptions] = useState<Client[]>([]);
  const [clientPanelMode, setClientPanelMode] = useState<"closed" | "picker" | "form">("closed");
  const [editingClient, setEditingClient] = useState<{ id: string; values: ClientFormValues } | null>(null);
  const [showClientList, setShowClientList] = useState(false);
  const [unlinkedCrmContacts, setUnlinkedCrmContacts] = useState<UnlinkedCrmContact[]>([]);
  const [linkingCrmId, setLinkingCrmId] = useState<string | null>(null);
  const [assignPicks, setAssignPicks] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [milestoneProjects, setMilestoneProjects] = useState<MilestoneProject[]>([]);
  const [ytd, setYtd] = useState<{ billedYTD: number; collectedYTD: number } | null>(null);
  const [phaseSelected, setPhaseSelected] = useState<Record<string, boolean>>({});
  const [allProjects, setAllProjects] = useState<ProjectListRow[]>([]);
  const [showProjectList, setShowProjectList] = useState(false);
  const [editingProjectBillingId, setEditingProjectBillingId] = useState<string | null>(null);

  const loadBoard = useCallback(async (activeTab: BoardTab) => {
    setLoading(true);
    const res = await fetch(`/api/billing-board?tab=${activeTab}`);
    const data = await res.json();
    setClients(data.clients || []);
    setMilestoneProjects(data.milestoneProjects || []);
    setYtd(data.ytd || null);
    const initialSelected: Record<string, boolean> = {};
    (data.clients || []).forEach((c: CandidateClient) =>
      c.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (t.billingStatus === "ready_to_invoice") initialSelected[t.clickupTaskId] = true;
        })
      )
    );
    setSelected(initialSelected);
    const initialPhaseSelected: Record<string, boolean> = {};
    (data.milestoneProjects || []).forEach((p: MilestoneProject) =>
      p.phases.forEach((phase) => {
        if (phase.status === "ready_to_bill") initialPhaseSelected[phase.id] = true;
      })
    );
    setPhaseSelected(initialPhaseSelected);
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

  const loadAllProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setAllProjects(data.projects || []);
  }, []);

  const loadUnlinkedCrmContacts = useCallback(async () => {
    const res = await fetch("/api/crm/unlinked-clients");
    const data = await res.json();
    setUnlinkedCrmContacts(data.contacts || []);
  }, []);

  useEffect(() => {
    loadBoard(tab);
  }, [tab, loadBoard]);

  useEffect(() => {
    loadAssignmentData();
    loadAllProjects();
    loadUnlinkedCrmContacts();
  }, [loadAssignmentData, loadAllProjects, loadUnlinkedCrmContacts]);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/sync/projects", { method: "POST" });
    setSyncing(false);
    await Promise.all([loadBoard(tab), loadAssignmentData()]);
    router.refresh();
  }

  async function handleClientSaved() {
    setClientPanelMode("closed");
    setEditingClient(null);
    await loadAssignmentData();
  }

  function closeClientPanel() {
    setClientPanelMode("closed");
    setEditingClient(null);
  }

  function startEditClient(c: Client) {
    setEditingClient({ id: c.id, values: clientToForm(c) });
    setClientPanelMode("form");
  }

  async function startAddClient() {
    if (clientPanelMode !== "closed") {
      closeClientPanel();
      return;
    }
    setEditingClient(null);
    await loadUnlinkedCrmContacts();
    setClientPanelMode("picker");
  }

  function startManualClient() {
    setEditingClient(null);
    setClientPanelMode("form");
  }

  async function handleLinkCrmContact(contact: UnlinkedCrmContact) {
    setLinkingCrmId(contact.clickupTaskId);
    const res = await fetch("/api/clients/link-crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickupTaskId: contact.clickupTaskId }),
    });
    const data = await res.json();
    setLinkingCrmId(null);
    if (data.client) {
      setEditingClient({ id: data.client.id, values: clientToForm(data.client) });
      setClientPanelMode("form");
      await Promise.all([loadAssignmentData(), loadUnlinkedCrmContacts()]);
    }
  }

  async function handleSetOverride(clickupTaskId: string, field: "hoursOverride" | "rateOverride", value: number) {
    await fetch("/api/task-billing-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickupTaskId, [field]: value }),
    });
    await loadBoard(tab);
  }

  async function handleResetOverride(clickupTaskId: string) {
    await fetch("/api/task-billing-overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickupTaskId }),
    });
    await loadBoard(tab);
  }

  async function handleAssign(projectId: string) {
    const clientId = assignPicks[projectId];
    if (!clientId) return;
    await fetch(`/api/projects/${projectId}/assign-client`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    await Promise.all([loadAssignmentData(), loadBoard(tab), loadAllProjects()]);
  }

  async function handleToggleReady(phase: MilestonePhase, ready: boolean) {
    await fetch(`/api/phase-billing/${phase.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: ready ? "ready_to_bill" : "not_started" }),
    });
    await loadBoard(tab);
  }

  async function handleBillingSetupSaved() {
    setEditingProjectBillingId(null);
    await Promise.all([loadBoard(tab), loadAllProjects()]);
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
    milestoneProjects.forEach((p) =>
      p.phases.forEach((phase) => {
        if (phaseSelected[phase.id] && phase.status === "ready_to_bill") {
          total += phase.amount;
          taskCount += 1;
          clientIds.add(p.clientId);
        }
      })
    );
    return { total: Math.round(total * 100) / 100, taskCount, clientCount: clientIds.size };
  }, [clients, selected, milestoneProjects, phaseSelected]);

  const selections = useMemo(() => {
    const byClient = new Map<string, { clientId: string; clientName: string; items: any[] }>();

    clients.forEach((c) => {
      c.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (selected[t.clickupTaskId] && t.billingStatus !== "invoiced") {
            if (!byClient.has(c.clientId)) byClient.set(c.clientId, { clientId: c.clientId, clientName: c.clientName, items: [] });
            byClient.get(c.clientId)!.items.push({
              kind: "task",
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
              rateBreakdown: t.rateBreakdown,
            });
          }
        })
      );
    });

    milestoneProjects.forEach((p) => {
      p.phases.forEach((phase) => {
        if (phaseSelected[phase.id] && phase.status === "ready_to_bill") {
          if (!byClient.has(p.clientId)) byClient.set(p.clientId, { clientId: p.clientId, clientName: p.clientName, items: [] });
          byClient.get(p.clientId)!.items.push({
            kind: "phase",
            phaseBillingId: phase.id,
            projectId: p.projectId,
            phaseName: phase.phase_name,
            percentOfContract: Number(phase.percent_of_contract),
            amount: phase.amount,
          });
        }
      });
    });

    return Array.from(byClient.values())
      .map((s) => ({ ...s, total: s.items.reduce((sum, i) => sum + i.amount, 0) }))
      .filter((s) => s.items.length > 0);
  }, [clients, selected, milestoneProjects, phaseSelected]);

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

  const byClientChart = useMemo(
    () =>
      clients
        .map((c) => ({ label: c.clientName, value: c.accumulatedTotal }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [clients]
  );

  const readyVsNotReady = useMemo(() => {
    if (tab !== "all") return null;
    let ready = 0;
    let notReady = 0;
    clients.forEach((c) =>
      c.projects.forEach((p) =>
        p.tasks.forEach((t) => {
          if (t.billingStatus === "ready_to_invoice") ready += t.amount;
          else if (t.billingStatus === "not_billed") notReady += t.amount;
        })
      )
    );
    return [
      { label: "Ready to invoice", value: ready, color: "var(--moss-lite)" },
      { label: "Not yet ready", value: notReady, color: "var(--moss)" },
    ];
  }, [tab, clients]);

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

      {ytd && (
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: -20, marginBottom: "var(--space-group)" }}>
          Year to date: ${ytd.billedYTD.toLocaleString(undefined, { maximumFractionDigits: 0 })} billed · $
          {ytd.collectedYTD.toLocaleString(undefined, { maximumFractionDigits: 0 })} collected
        </p>
      )}

      {!loading && byClientChart.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: readyVsNotReady ? "1fr 1fr" : "1fr", gap: "var(--space-group)", marginBottom: "var(--space-group)" }}>
          <div className="panel" style={{ padding: 20 }}>
            <div className="panel-title" style={{ marginBottom: 14 }}>
              By client ({tab})
            </div>
            <BarChart data={byClientChart} />
          </div>
          {readyVsNotReady && (
            <div className="panel" style={{ padding: 20 }}>
              <div className="panel-title" style={{ marginBottom: 14 }}>
                Ready vs. not yet ready
              </div>
              <BarChart data={readyVsNotReady} />
            </div>
          )}
        </div>
      )}

      <div className="panel" style={{ padding: 20, marginBottom: "var(--space-group)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: clientPanelMode !== "closed" || showClientList ? 16 : 0 }}>
          <div className="panel-title">Clients</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" onClick={() => setShowClientList((s) => !s)}>
              {showClientList ? "Hide clients" : `Manage clients (${clientOptions.length})`}
            </button>
            <button className="btn-primary" onClick={startAddClient}>
              {clientPanelMode !== "closed" ? "Cancel" : "+ New client"}
            </button>
          </div>
        </div>

        {clientPanelMode === "picker" && (
          <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0, marginBottom: 16 }}>
              Pick the ClickUp CRM contact this billing profile belongs to — keeps the client's identity
              tied to CRM instead of typed twice. You'll add phone/address/rate next.
            </p>
            {unlinkedCrmContacts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
                Every CRM contact already has a billing profile.
              </p>
            ) : (
              unlinkedCrmContacts.map((contact) => (
                <div
                  key={contact.clickupTaskId}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}
                >
                  <div>
                    <div className="table-value">{contact.companyName || contact.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {[contact.primaryContact, contact.companyName ? contact.name : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => handleLinkCrmContact(contact)}
                    disabled={linkingCrmId === contact.clickupTaskId}
                  >
                    {linkingCrmId === contact.clickupTaskId ? "Linking…" : "Use this contact"}
                  </button>
                </div>
              ))
            )}
            <button type="button" className="btn-secondary" onClick={startManualClient} style={{ marginTop: 16 }}>
              + Add a client not in ClickUp CRM
            </button>
          </div>
        )}

        {clientPanelMode === "form" && (
          <ClientForm
            key={editingClient?.id ?? "new"}
            initial={editingClient?.values ?? emptyClientForm()}
            editing={editingClient?.id ?? null}
            onSaved={handleClientSaved}
            onCancel={closeClientPanel}
          />
        )}

        {showClientList && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientOptions.map((c) => (
                <tr key={c.id}>
                  <td className="table-value">
                    {c.name}
                    {c.company_name && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.company_name}</div>}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{c.contact_name ?? "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{c.contact_email ?? "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>{c.contact_phone ?? "—"}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => startEditClient(c)} style={{ padding: "6px 12px" }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ padding: 20, marginBottom: "var(--space-group)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showProjectList ? 16 : 0 }}>
          <div>
            <div className="panel-title">Project Billing Setup</div>
            <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4, marginBottom: 0 }}>
              Set how each project bills — hourly, or a percentage of the contract per design phase.
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setShowProjectList((s) => !s)}>
            {showProjectList ? "Hide projects" : `Show projects (${allProjects.length})`}
          </button>
        </div>

        {showProjectList && (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Type</th>
                <th>Timeline</th>
                <th>Billing model</th>
                <th className="money">Contract value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allProjects.map((p) => (
                <tr key={p.id}>
                  <td className="table-value">{p.name}</td>
                  <td style={{ color: "var(--text-dim)" }}>{p.clients?.name ?? "—"}</td>
                  <td style={{ color: "var(--text-dim)", fontSize: 13 }}>{p.project_type ?? "—"}</td>
                  <td style={{ color: "var(--text-dim)", fontSize: 13 }}>
                    {p.start_date ?? "—"}
                    {p.projected_end_date && <> – {p.projected_end_date}</>}
                  </td>
                  <td>
                    <span className="badge">{BILLING_TYPE_LABEL[p.billing_type] ?? p.billing_type}</span>
                  </td>
                  <td className="money table-value figure">{p.contract_value ? `$${Number(p.contract_value).toFixed(2)}` : "—"}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => setEditingProjectBillingId(p.id)} style={{ padding: "6px 12px" }}>
                      Edit billing
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingProjectBillingId && (
        <ProjectBillingSetup
          projectId={editingProjectBillingId}
          onClose={() => setEditingProjectBillingId(null)}
          onSaved={handleBillingSetupSaved}
        />
      )}

      <MilestoneBilling
        projects={milestoneProjects}
        selected={phaseSelected}
        onToggleSelected={(phaseId, checked) => setPhaseSelected((s) => ({ ...s, [phaseId]: checked }))}
        onToggleReady={handleToggleReady}
        onEditProject={(projectId) => setEditingProjectBillingId(projectId)}
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
                            {task.rateBreakdown && (
                              <div style={{ fontSize: 12, color: task.hasOverride ? "var(--oxide)" : "var(--text-faint)", marginTop: 2 }}>
                                {task.rateBreakdown}
                                {task.hasOverride && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetOverride(task.clickupTaskId)}
                                    style={{ background: "none", border: "none", color: "var(--moss-lite)", cursor: "pointer", padding: 0, marginLeft: 8, fontSize: 12, textDecoration: "underline" }}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            )}
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
                          <td className="money">
                            <input
                              key={`hours-${task.clickupTaskId}-${task.hours}`}
                              type="number"
                              step="0.1"
                              defaultValue={task.hours}
                              disabled={task.billingStatus === "invoiced"}
                              onBlur={(e) => {
                                const value = Number(e.target.value);
                                if (Number.isFinite(value) && value !== task.hours) handleSetOverride(task.clickupTaskId, "hoursOverride", value);
                              }}
                              style={{ width: 60, padding: 4, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", textAlign: "right" }}
                            />
                          </td>
                          <td className="money">
                            <input
                              key={`rate-${task.clickupTaskId}-${task.hourlyRate}`}
                              type="number"
                              step="0.01"
                              defaultValue={task.hourlyRate}
                              disabled={task.billingStatus === "invoiced"}
                              onBlur={(e) => {
                                const value = Number(e.target.value);
                                if (Number.isFinite(value) && value !== task.hourlyRate) handleSetOverride(task.clickupTaskId, "rateOverride", value);
                              }}
                              style={{ width: 70, padding: 4, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", textAlign: "right" }}
                            />
                          </td>
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
