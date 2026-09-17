-- General ledger foundation, payroll (employee profiles + tax engine
-- output), and expenses. Every real business event posts a balanced
-- journal entry so P&L / Balance Sheet / Budget are derived from one
-- consistent set of books rather than ad-hoc queries.

-- ============ CHART OF ACCOUNTS ============
create table accounts (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  name           text not null,
  type           text not null check (type in ('asset','liability','equity','revenue','expense')),
  normal_balance text not null check (normal_balance in ('debit','credit')),
  is_active      boolean not null default true
);

insert into accounts (code, name, type, normal_balance) values
  ('1000', 'Cash — Operating',        'asset',     'debit'),
  ('1100', 'Accounts Receivable',     'asset',     'debit'),
  ('1500', 'Fixed Assets',            'asset',     'debit'),
  ('2000', 'Accounts Payable',        'liability', 'credit'),
  ('2100', 'Payroll Tax Payable',     'liability', 'credit'),
  ('3000', 'Member Equity',           'equity',    'credit'),
  ('3100', 'Member Draws',            'equity',    'debit'),
  ('3900', 'Retained Earnings',       'equity',    'credit'),
  ('4000', 'Design Fee Revenue',      'revenue',   'credit'),
  ('5000', 'Wages Expense',           'expense',   'debit'),
  ('5100', 'Payroll Tax Expense',     'expense',   'debit'),
  ('5200', 'Contract Labor',          'expense',   'debit'),
  ('6000', 'Software & Subscriptions','expense',   'debit'),
  ('6100', 'Rent',                    'expense',   'debit'),
  ('6200', 'Insurance',               'expense',   'debit'),
  ('6300', 'Professional Fees',       'expense',   'debit'),
  ('6400', 'Office Supplies',         'expense',   'debit'),
  ('6500', 'Travel',                  'expense',   'debit'),
  ('6600', 'Meals',                   'expense',   'debit'),
  ('6700', 'Utilities',               'expense',   'debit'),
  ('6800', 'Bank Fees',               'expense',   'debit'),
  ('6900', 'Other Expense',           'expense',   'debit');

-- ============ JOURNAL ============
create table journal_entries (
  id          uuid primary key default gen_random_uuid(),
  entry_date  date not null,
  description text not null,
  source_type text not null, -- 'invoice_issued' | 'invoice_paid' | 'expense' | 'payroll' | 'owner_draw' | 'manual'
  source_id   text,
  created_at  timestamptz not null default now()
);

create table journal_lines (
  id                uuid primary key default gen_random_uuid(),
  journal_entry_id  uuid references journal_entries(id) on delete cascade not null,
  account_id        uuid references accounts(id) not null,
  debit             numeric(12,2) not null default 0,
  credit            numeric(12,2) not null default 0,
  memo              text
);

create index on journal_lines (account_id);
create index on journal_lines (journal_entry_id);
create index on journal_entries (entry_date);

alter table invoices add column if not exists paid_amount numeric(12,2) not null default 0;

-- ============ EMPLOYEES ============
create table employees (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  email                       text,
  role_title                  text,
  employee_type               text not null check (employee_type in ('w2_hourly','w2_salary','1099','owner_draw')),
  clickup_user_id             text,
  hourly_rate                 numeric(10,2),
  annual_salary               numeric(12,2),
  filing_status               text default 'single' check (filing_status in ('single','married_jointly','head_of_household')),
  step2_multiple_jobs         boolean not null default false,
  dependents_amount_annual    numeric(10,2) not null default 0,
  other_income_annual         numeric(10,2) not null default 0,
  deductions_annual           numeric(10,2) not null default 0,
  extra_withholding_per_period numeric(10,2) not null default 0,
  pretax_401k_percent         numeric(5,2) not null default 0,
  pretax_section125_per_period numeric(10,2) not null default 0,
  posttax_deductions_per_period numeric(10,2) not null default 0,
  pto_accrual_hours_per_period numeric(6,2) not null default 0,
  pto_balance_hours           numeric(6,2) not null default 0,
  state                       text not null default 'FL',
  is_active                   boolean not null default true,
  hire_date                   date,
  created_at                  timestamptz not null default now()
);

create table pay_runs (
  id           uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end   date not null,
  pay_date     date not null,
  status       text not null default 'draft' check (status in ('draft','finalized')),
  created_at   timestamptz not null default now()
);

create table paystubs (
  id                          uuid primary key default gen_random_uuid(),
  pay_run_id                  uuid references pay_runs(id) on delete cascade not null,
  employee_id                 uuid references employees(id) not null,
  regular_hours               numeric(6,2) not null default 0,
  overtime_hours              numeric(6,2) not null default 0,
  pto_hours_used              numeric(6,2) not null default 0,
  gross_pay                   numeric(12,2) not null default 0,
  pretax_401k                 numeric(12,2) not null default 0,
  pretax_section125           numeric(12,2) not null default 0,
  federal_taxable_wages       numeric(12,2) not null default 0,
  federal_income_tax          numeric(12,2) not null default 0,
  social_security_employee    numeric(12,2) not null default 0,
  medicare_employee           numeric(12,2) not null default 0,
  additional_medicare_employee numeric(12,2) not null default 0,
  social_security_employer    numeric(12,2) not null default 0,
  medicare_employer           numeric(12,2) not null default 0,
  futa_employer               numeric(12,2) not null default 0,
  suta_employer               numeric(12,2) not null default 0,
  posttax_deductions          numeric(12,2) not null default 0,
  net_pay                     numeric(12,2) not null default 0,
  ytd_gross                   numeric(12,2) not null default 0,
  ytd_federal_tax             numeric(12,2) not null default 0,
  ytd_ss_employee             numeric(12,2) not null default 0,
  ytd_medicare_employee       numeric(12,2) not null default 0,
  ytd_net                     numeric(12,2) not null default 0,
  ytd_pto_used                numeric(6,2) not null default 0,
  journal_entry_id            uuid references journal_entries(id),
  created_at                  timestamptz not null default now()
);

create index on paystubs (employee_id);
create index on paystubs (pay_run_id);

-- ============ EXPENSES ============
create table expenses (
  id            uuid primary key default gen_random_uuid(),
  expense_date  date not null,
  description   text not null,
  amount        numeric(12,2) not null,
  account_id    uuid references accounts(id),
  source        text not null default 'csv_import' check (source in ('csv_import','manual')),
  raw_csv_row   jsonb,
  journal_entry_id uuid references journal_entries(id),
  status        text not null default 'uncategorized' check (status in ('uncategorized','categorized')),
  created_at    timestamptz not null default now()
);

create index on expenses (expense_date);
create index on expenses (status);

-- ============ BUDGET ============
create table budget_lines (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid references accounts(id) not null,
  month           date not null, -- first-of-month marker
  budgeted_amount numeric(12,2) not null default 0,
  unique (account_id, month)
);

alter table accounts enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
alter table employees enable row level security;
alter table pay_runs enable row level security;
alter table paystubs enable row level security;
alter table expenses enable row level security;
alter table budget_lines enable row level security;
