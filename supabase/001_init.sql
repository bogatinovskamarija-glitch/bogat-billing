-- Bogat Billing — initial schema
-- ClickUp stays source of truth for live task/comment/time data (queried at
-- Billing Review time). These tables hold only what's genuinely new: clients,
-- a thin project pointer, and invoices (the durable financial record).

create table clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  company_name        text,
  contact_name        text,
  contact_email       text,
  billing_address     text,
  default_hourly_rate numeric(10,2),
  clickup_crm_task_id text,        -- pointer into CRM list 901314847597, traceability only
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Thin cache/pointer, manually refreshed via the "sync projects" action —
-- not continuously synced, to avoid drift with ClickUp's live task data.
create table projects (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 uuid references clients(id),
  clickup_project_task_id   text,          -- task in Projects list 901307244510, if matched
  clickup_folder_id         text,
  clickup_list_id           text unique,   -- e.g. the per-project task list id — sync upsert key
  name                      text not null,
  current_phase             text,
  billing_type              text,          -- mirrors ClickUp "Billing Type" options
  hourly_rate               numeric(10,2),
  is_active                 boolean not null default true,
  last_synced_at            timestamptz,
  created_at                timestamptz not null default now()
);

-- One row per generated invoice. One client per invoice, may span multiple projects.
create table invoices (
  id                      uuid primary key default gen_random_uuid(),
  invoice_number          text unique not null,          -- e.g. BOGAT-2026-014
  client_id               uuid references clients(id) not null,
  period_start            date,
  period_end              date,
  status                  text not null default 'draft', -- mirrors ClickUp "Payment Status"
  subtotal                numeric(10,2) not null,
  tax_amount              numeric(10,2) not null default 0,
  total_amount            numeric(10,2) not null,
  currency                text not null default 'USD',
  issued_date             date,
  due_date                date,
  sent_date               date,
  paid_date               date,
  pdf_storage_path        text,           -- Supabase Storage object path
  clickup_invoice_task_id text,           -- task auto-created in Invoices list 901317966819
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- The durable, immutable-once-invoiced snapshot of what was billed.
-- unique(clickup_task_id) is the transactional anti-double-billing gate.
create table invoice_line_items (
  id                 uuid primary key default gen_random_uuid(),
  invoice_id         uuid references invoices(id) on delete cascade not null,
  project_id         uuid references projects(id),
  clickup_task_id    text not null unique,
  clickup_list_id    text not null,
  task_name          text not null,
  phase              text,
  hours              numeric(6,2) not null default 0,
  hourly_rate        numeric(10,2),
  amount             numeric(10,2) not null,
  progress_narrative text,
  narrative_source   text not null default 'raw_comments', -- 'raw_comments' | 'ai_summary'
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);

-- Audit trail of which raw ClickUp time entries backed each line item.
-- Also the natural seed table for phase-2 payroll prep.
create table invoice_line_item_time_entries (
  id                    uuid primary key default gen_random_uuid(),
  invoice_line_item_id  uuid references invoice_line_items(id) on delete cascade not null,
  clickup_time_entry_id text not null,
  duration_ms           bigint not null,
  is_billable           boolean not null,
  entry_date            date,
  note                  text
);

create index on projects (client_id);
create index on invoices (client_id);
create index on invoice_line_items (invoice_id);
create index on invoice_line_item_time_entries (invoice_line_item_id);

alter table clients enable row level security;
alter table projects enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table invoice_line_item_time_entries enable row level security;
-- No public policies — every read/write goes through Next.js API routes using
-- the Supabase service-role key (same pattern as ../chatbot/supabase-setup.sql).
