-- Adds Contract Value to projects (for Overview's by-project progress rail)
-- and a thin CRM overlay table for concepts ClickUp doesn't track natively
-- (relationship tier, touch cadence, strength) — ClickUp's CRM list stays
-- the source of truth for the contact itself.

alter table projects add column if not exists contract_value numeric(12,2);

create table if not exists crm_contacts (
  id               uuid primary key default gen_random_uuid(),
  clickup_task_id  text unique not null,
  tier             text,        -- 'A' | 'B' | 'C' | null
  strength         int not null default 3, -- 1-5
  last_touch_date  date,
  next_touch_date  date,
  referral_potential text,      -- 'High' | 'Medium' | 'Low' | null
  working_note     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table crm_contacts enable row level security;
-- No public policies — same pattern as every other table here.
