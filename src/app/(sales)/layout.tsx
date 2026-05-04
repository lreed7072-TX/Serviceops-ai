import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import NotificationBell from "@/components/notifications/NotificationBell";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import SidebarNav from "@/components/SidebarNav";
import type { NavItem } from "@/components/SidebarNav";
import "../(app)/shell.css";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) redirect("/login");

  // SALES, ADMIN, and DISPATCHER can access the sales route group
  if (auth.role === Role.TECH) redirect("/tech");

  const navLinks: NavItem[] = [
    // ── Sales ──
    { kind: "divider", label: "Sales" },
    { kind: "link", href: "/sales/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
    { kind: "link", href: "/sales/customers", label: "Customers", iconName: "Users" },
    { kind: "link", href: "/sales/calls", label: "Call Log", iconName: "Phone" },
    { kind: "link", href: "/sales/follow-ups", label: "Follow-ups", iconName: "CalendarClock" },

    // ── Pipeline ──
    { kind: "divider", label: "Pipeline" },
    { kind: "link", href: "/sales/opportunities", label: "Opportunities", iconName: "Target" },
    { kind: "link", href: "/sales/service-tickets", label: "Service Tickets", iconName: "Ticket" },

    // ── Insights ──
    { kind: "divider", label: "Insights" },
    { kind: "link", href: "/sales/reports", label: "Reports", iconName: "PieChart" },

    // ── Admin (ADMIN role only) ──
    ...(auth.role === Role.ADMIN ? [
      { kind: "divider" as const, label: "Admin" },
      { kind: "link" as const, href: "/sales/settings", label: "CRM Settings", iconName: "Settings" },
      { kind: "link" as const, href: "/dashboard", label: "Operations View", iconName: "ClipboardList" },
    ] : []),
  ];

  return (
    <div className="shell">
      <SidebarNav
        links={navLinks}
        footerSlot={
          <>
            <NotificationBell />
            <LogoutButton />
          </>
        }
      />

      <main className="main">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
