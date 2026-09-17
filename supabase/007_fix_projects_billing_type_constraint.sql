-- 005's "add column if not exists billing_type" was a no-op: the column
-- already existed from 001_init (nullable text, no default), so its NOT NULL
-- DEFAULT and CHECK never actually got attached. Backfill and add them now.

update projects set billing_type = 'hourly' where billing_type is null;

alter table projects alter column billing_type set default 'hourly';
alter table projects alter column billing_type set not null;

alter table projects add constraint projects_billing_type_check
  check (billing_type in ('hourly','percentage_phase','fixed_fee','retainer','pro_bono'));
