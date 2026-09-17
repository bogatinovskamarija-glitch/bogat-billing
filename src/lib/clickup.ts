import { CLICKUP_TEAM_ID } from "./clickup-field-ids";

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

function apiKey(): string {
  const key = process.env.CLICKUP_API_KEY;
  if (!key) throw new Error("CLICKUP_API_KEY not set");
  return key;
}

async function clickupFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CLICKUP_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: apiKey(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ClickUp ${init?.method || "GET"} ${path} failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface ClickUpTask {
  id: string;
  custom_id: string | null;
  name: string;
  status: { status: string };
  date_closed: string | null;
  date_updated: string;
  assignees: { id: number; username: string }[];
  list: { id: string; name: string };
}

// Tasks in a project list at a given status — used to find billing
// candidates (status "bill") without pulling every task in the list.
export async function listTasksByStatus(listId: string, status: string): Promise<ClickUpTask[]> {
  const params = new URLSearchParams({ include_closed: "true", subtasks: "true" });
  params.append("statuses[]", status);
  const data = await clickupFetch<{ tasks: ClickUpTask[] }>(
    `/list/${listId}/task?${params.toString()}`
  );
  return data.tasks;
}

export interface ClickUpTimeEntry {
  id: string;
  task: { id: string } | null;
  duration: string; // ms, as a string
  start: string;
  billable: boolean;
}

// Billable/non-billable time entries for one task. ClickUp's `is_billable`
// flag on the entry itself (not a custom field) is the source of truth for
// what counts toward an invoice.
export async function getTaskTimeEntries(taskId: string): Promise<ClickUpTimeEntry[]> {
  const params = new URLSearchParams({ task_id: taskId, assignee: "" });
  const data = await clickupFetch<{ data: ClickUpTimeEntry[] }>(
    `/team/${CLICKUP_TEAM_ID}/time_entries?${params.toString()}`
  );
  return data.data;
}

export function billableHours(entries: ClickUpTimeEntry[]): number {
  const ms = entries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + parseInt(e.duration, 10), 0);
  return Math.round((ms / 1000 / 60 / 60) * 100) / 100;
}

export interface ClickUpComment {
  id: string;
  comment_text: string;
  date: string;
  user: { username: string };
}

// Most recent comments on a task, used to build the v1 progress narrative
// (see lib/narrative.ts) — literal excerpts, no summarization in the MVP.
export async function getTaskComments(taskId: string): Promise<ClickUpComment[]> {
  const data = await clickupFetch<{ comments: ClickUpComment[] }>(`/task/${taskId}/comment`);
  return data.comments;
}

// Set a single custom field value on a task (used in Phase D for the
// Invoiced/Invoice # write-back and the Invoices-list field population).
export async function setTaskField(taskId: string, fieldId: string, value: unknown): Promise<void> {
  await clickupFetch(`/task/${taskId}/field/${fieldId}`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

// Create a task in a list (used in Phase D to auto-create the Invoices-list
// entry, replacing Maria's manual "create a task per invoice" step).
export async function createTask(
  listId: string,
  params: { name: string; description?: string }
): Promise<{ id: string }> {
  return clickupFetch(`/list/${listId}/task`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface ClickUpList {
  id: string;
  name: string;
  folder: { id: string; name: string };
}

// List metadata (used by the project sync to pick up name changes).
export async function getList(listId: string): Promise<ClickUpList> {
  return clickupFetch(`/list/${listId}`);
}

export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  type_config?: { options?: { id: string; name?: string; label?: string; orderindex: number }[] };
  value?: unknown;
}

export interface ClickUpTaskFull extends ClickUpTask {
  custom_fields: ClickUpCustomField[];
}

// Full task detail including custom_fields — the v2 API returns these by
// default on GET /task/{id}, unlike the compact /list/{id}/task listing.
export async function getTask(taskId: string): Promise<ClickUpTaskFull> {
  return clickupFetch(`/task/${taskId}`);
}

// All tasks in a list (no status filter) with custom fields — used to read
// the Projects-list summary tasks (Hourly Rate, Current Phase, Client).
export async function listAllTasks(listId: string): Promise<ClickUpTaskFull[]> {
  const params = new URLSearchParams({ include_closed: "true", subtasks: "true" });
  const data = await clickupFetch<{ tasks: ClickUpTaskFull[] }>(
    `/list/${listId}/task?${params.toString()}`
  );
  return data.tasks;
}

export function getCustomFieldValue(task: ClickUpTaskFull, fieldId: string): unknown {
  return task.custom_fields.find((f) => f.id === fieldId)?.value;
}

// Resolves a dropdown field's stored value (option UUID, or in some legacy
// fields the option's numeric orderindex) to its human-readable label.
export function resolveDropdownLabel(
  task: ClickUpTaskFull,
  fieldId: string
): string | null {
  const field = task.custom_fields.find((f) => f.id === fieldId);
  if (!field || field.value == null) return null;
  const options = field.type_config?.options || [];
  const byId = options.find((o) => o.id === field.value);
  if (byId) return byId.name || byId.label || null;
  if (typeof field.value === "number") {
    const byIndex = options.find((o) => o.orderindex === field.value);
    if (byIndex) return byIndex.name || byIndex.label || null;
  }
  return null;
}

// Strips a leading "YYMMDD - " / "YYMMDD-" date prefix and normalizes for
// fuzzy-matching a Projects-list summary task's name against its actual
// work list's name (the two are hand-typed independently and drift in
// spacing/punctuation, e.g. "260821-Arraigo" vs "08212026 - Arraigo").
export function normalizeProjectKey(name: string): string {
  return name
    .replace(/^\s*\d{6,8}\s*-?\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
