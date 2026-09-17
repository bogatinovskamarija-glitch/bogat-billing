import { supabaseAdmin } from "@/lib/supabase";
import Sidebar from "../../components/Sidebar";

export const dynamic = "force-dynamic";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdueInvoices } = await supabaseAdmin
    .from("invoices")
    .select("id")
    .lt("due_date", today)
    .not("status", "in", "(paid,void)");

  const { data: lastSync } = await supabaseAdmin
    .from("projects")
    .select("last_synced_at")
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pendingExpenses } = await supabaseAdmin.from("expenses").select("id").eq("status", "uncategorized");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        invoicesBadge={overdueInvoices?.length ?? 0}
        expensesBadge={pendingExpenses?.length ?? 0}
        userName="Maria Bogat"
        userRole="Principal"
        lastSyncedLabel={relativeTime(lastSync?.last_synced_at ?? null)}
      />
      <div style={{ flex: 1, padding: "40px", maxWidth: 1240 + 80 }}>
        <div style={{ maxWidth: 1240 }}>{children}</div>
      </div>
    </div>
  );
}
