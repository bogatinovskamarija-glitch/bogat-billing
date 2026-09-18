-- Employee mailing address + bank info for real paystub PDFs. Only the last
-- 4 digits of the account are ever stored — never a full account number,
-- since nothing downstream needs more than that to be useful to Maria, and
-- storing a full number would be pure liability.
alter table employees add column if not exists mailing_address text;
alter table employees add column if not exists bank_name text;
alter table employees add column if not exists bank_account_last4 text;

-- Snapshot columns on paystubs — frozen at generation time, same treatment
-- as hours/rate/amount are already frozen onto invoice line items, so a
-- past paystub keeps showing what was true when it was issued even if the
-- employee's address/bank later changes.
alter table paystubs add column if not exists employee_address text;
alter table paystubs add column if not exists bank_account_last4 text;
