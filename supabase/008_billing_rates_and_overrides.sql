-- Rate should follow the person who did the work, not just a flat
-- per-project number — billing_rate is what's charged to clients, distinct
-- from hourly_rate (what she pays the employee via payroll).
alter table employees add column if not exists billing_rate numeric(10,2);

-- A manual, persisted correction to a task's computed hours/rate on the
-- Billing Board (same trust model as PTO-hours-used on a draft pay run).
-- Keyed by the ClickUp task id directly since these tasks aren't otherwise
-- tracked as their own row in this schema.
create table if not exists task_billing_overrides (
  clickup_task_id text primary key,
  hours_override  numeric(6,2),
  rate_override   numeric(10,2),
  updated_at      timestamptz not null default now()
);

alter table task_billing_overrides enable row level security;

-- Freezes the per-employee rate breakdown onto the invoice line at
-- generation time, same treatment as hours/rate/amount already get, so a
-- later change to an employee's billing rate never retroactively changes
-- what an already-issued invoice shows.
alter table invoice_line_items add column if not exists rate_breakdown text;
