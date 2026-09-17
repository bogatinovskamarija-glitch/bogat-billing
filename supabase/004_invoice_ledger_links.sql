-- Links invoices to their issuing journal entry, and tracks individual
-- payments (an invoice can be paid in installments) each with its own
-- journal entry.

alter table invoices add column if not exists journal_entry_id uuid references journal_entries(id);

create table if not exists invoice_payments (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid references invoices(id) on delete cascade not null,
  amount           numeric(12,2) not null,
  paid_date        date not null,
  journal_entry_id uuid references journal_entries(id),
  created_at       timestamptz not null default now()
);

alter table invoice_payments enable row level security;
