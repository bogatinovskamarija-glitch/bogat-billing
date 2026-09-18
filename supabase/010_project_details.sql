-- Richer project data, read one-way from ClickUp's Projects list (same
-- treatment as hourly_rate/contract_value/current_phase already get).
alter table projects add column if not exists project_type text;
alter table projects add column if not exists building_type text;
alter table projects add column if not exists start_date date;
alter table projects add column if not exists projected_end_date date;
alter table projects add column if not exists total_construction_budget numeric(14,2);
alter table projects add column if not exists drive_folder_url text;
