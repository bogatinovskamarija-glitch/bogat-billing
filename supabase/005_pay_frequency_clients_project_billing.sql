-- Pay frequency moves onto the employee (and the run), real client contact
-- fields, and phase-based project billing as a second billing model
-- alongside the existing hourly-task one.

alter table employees add column if not exists pay_frequency text not null default 'semi_monthly'
  check (pay_frequency in ('weekly','biweekly','semi_monthly','monthly'));

alter table pay_runs add column if not exists pay_frequency text not null default 'semi_monthly'
  check (pay_frequency in ('weekly','biweekly','semi_monthly','monthly'));

alter table clients add column if not exists contact_phone text;

alter table projects add column if not exists billing_type text not null default 'hourly'
  check (billing_type in ('hourly','percentage_phase','fixed_fee','retainer','pro_bono'));

create table if not exists project_phase_billing (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references projects(id) on delete cascade not null,
  phase_name          text not null,
  percent_of_contract numeric(5,2) not null default 0,
  status              text not null default 'not_started' check (status in ('not_started','ready_to_bill','billed')),
  invoice_line_item_id uuid,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists project_phase_billing_project_idx on project_phase_billing (project_id);

-- A phase-billing line item has no ClickUp task behind it — relax the
-- existing hourly-task constraint. Postgres allows multiple NULLs under a
-- unique constraint, so the anti-double-billing gate for real tasks still
-- holds exactly as before.
alter table invoice_line_items alter column clickup_task_id drop not null;
alter table invoice_line_items alter column clickup_list_id drop not null;
alter table invoice_line_items add column if not exists phase_billing_id uuid references project_phase_billing(id);

alter table project_phase_billing enable row level security;
