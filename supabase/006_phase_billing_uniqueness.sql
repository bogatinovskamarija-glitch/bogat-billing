-- Anti-double-billing gate for phase-billing line items, mirroring the
-- existing unique(clickup_task_id) gate for hourly-task line items. Postgres
-- partial unique indexes tolerate multiple NULLs, so hourly-task rows
-- (phase_billing_id null) are untouched.

create unique index if not exists invoice_line_items_phase_billing_id_uniq
  on invoice_line_items (phase_billing_id)
  where phase_billing_id is not null;
