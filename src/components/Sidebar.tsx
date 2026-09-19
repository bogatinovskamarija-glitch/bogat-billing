"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  num: string;
  label: string;
  href: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Financial",
    items: [
      { num: "01", label: "Overview", href: "/overview" },
      { num: "02", label: "Profit & Loss", href: "/reports/pnl" },
      { num: "03", label: "Balance Sheet", href: "/reports/balance-sheet" },
      { num: "04", label: "Budget", href: "/reports/budget" },
      { num: "05", label: "Bank Reconciliation", href: "/reports/bank-reconciliation" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { num: "06", label: "Billing Board", href: "/billing-board" },
      { num: "07", label: "Invoices", href: "/invoices" },
    ],
  },
  {
    label: "Expenses",
    items: [
      { num: "08", label: "Expenses", href: "/expenses" },
      { num: "09", label: "Bills", href: "/bills" },
    ],
  },
  {
    label: "Clients",
    items: [
      { num: "10", label: "CRM", href: "/crm" },
      { num: "11", label: "Pipeline", href: "/pipeline" },
    ],
  },
  { label: "People", items: [{ num: "12", label: "Payroll", href: "/payroll" }] },
];

export default function Sidebar({
  invoicesBadge,
  expensesBadge,
  userName,
  userRole,
  lastSyncedLabel,
}: {
  invoicesBadge: number;
  expensesBadge: number;
  userName: string;
  userRole: string;
  lastSyncedLabel: string;
}) {
  const pathname = usePathname();
  const badges: Record<string, number> = { "/invoices": invoicesBadge, "/expenses": expensesBadge };
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      style={{
        width: 254,
        flexShrink: 0,
        background: "var(--forest)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ padding: "24px 20px", flexShrink: 0 }}>
        <img src="/brand/logo-white.png" alt="Bogat OS" style={{ width: 162 }} />
      </div>

      {/* flex: 1 + its own overflow-y makes this the one scrollable region —
          without it, a nav list taller than the viewport (as this one now
          is) has no way to reach its lower items at all, sticky positioning
          gives it nowhere to go. The embedded ClickUp view surfaces this
          first since its chrome eats extra vertical space, but the same cap
          bites in a plain browser on a shorter window too. */}
      <nav style={{ padding: "0 20px", flex: 1, overflowY: "auto", minHeight: 0 }}>
          {NAV.map((group) => (
            <div key={group.label} style={{ marginBottom: "var(--space-group)" }}>
              <div className="label" style={{ color: "var(--text-faint)", marginBottom: 8 }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = pathname === item.href;
                const badge = badges[item.href];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 8px",
                      position: "relative",
                      color: active ? "var(--white)" : "var(--text-dim)",
                      background: active ? "var(--hover)" : "transparent",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: -8,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: active ? "var(--moss-lite)" : "transparent",
                      }}
                    />
                    <span style={{ fontSize: 12, color: "var(--text-faint)", width: 16 }}>{item.num}</span>
                    <span style={{ fontSize: 14, flex: 1, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span
                        className="badge"
                        style={{
                          background: "var(--raised)",
                          borderColor: "var(--line)",
                          color: "var(--text)",
                          padding: "2px 7px",
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
      </nav>

      <div style={{ padding: 20, borderTop: "1px solid var(--line)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: "var(--raised)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{userName}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{userRole}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-faint)" }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--moss-lite)",
              animation: "pulse 3.2s ease-in-out infinite",
            }}
          />
          ClickUp synced · {lastSyncedLabel}
        </div>
      </div>
    </aside>
  );
}
