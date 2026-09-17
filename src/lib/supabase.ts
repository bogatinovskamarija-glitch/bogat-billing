import { createClient } from "@supabase/supabase-js";

// Service-role client — server-only (API routes, never imported by client
// components). RLS is enabled with no public policies (see
// supabase/001_init.sql), so every read/write goes through this client,
// gated by the Supabase Auth session check in middleware.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

export interface Client {
  id: string;
  name: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  billing_address: string | null;
  default_hourly_rate: number | null;
  clickup_crm_task_id: string | null;
}

export interface Project {
  id: string;
  client_id: string | null;
  clickup_project_task_id: string | null;
  clickup_folder_id: string | null;
  clickup_list_id: string | null;
  name: string;
  current_phase: string | null;
  billing_type: string | null;
  hourly_rate: number | null;
  is_active: boolean;
  last_synced_at: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  period_start: string | null;
  period_end: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  issued_date: string | null;
  due_date: string | null;
  sent_date: string | null;
  paid_date: string | null;
  pdf_storage_path: string | null;
  clickup_invoice_task_id: string | null;
  notes: string | null;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  project_id: string | null;
  clickup_task_id: string;
  clickup_list_id: string;
  task_name: string;
  phase: string | null;
  hours: number;
  hourly_rate: number | null;
  amount: number;
  progress_narrative: string | null;
  narrative_source: "raw_comments" | "ai_summary";
  sort_order: number;
}
