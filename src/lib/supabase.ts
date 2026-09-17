import { createClient } from "@supabase/supabase-js";

// Service-role client — server-only (API routes, never imported by client
// components). RLS is enabled with no public policies (see
// supabase/001_init.sql), so every read/write goes through this client,
// gated by the Supabase Auth session check in middleware.
//
// `cache: "no-store"` on the underlying fetch is required, not optional:
// Next.js persists a Data Cache for fetch() calls to disk (.next/cache) and
// will keep serving a stale/empty result across dev-server restarts —
// `export const dynamic = "force-dynamic"` on a page does NOT reliably
// disable this for fetches made inside a library like supabase-js. Financial
// data must never be served from that cache.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: { persistSession: false },
    global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) },
  }
);

export interface Client {
  id: string;
  name: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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
  billing_type: "hourly" | "percentage_phase" | "fixed_fee" | "retainer" | "pro_bono";
  hourly_rate: number | null;
  contract_value: number | null;
  is_active: boolean;
  last_synced_at: string | null;
}

export interface ProjectPhaseBilling {
  id: string;
  project_id: string;
  phase_name: string;
  percent_of_contract: number;
  status: "not_started" | "ready_to_bill" | "billed";
  invoice_line_item_id: string | null;
  sort_order: number;
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
