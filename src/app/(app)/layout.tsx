import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import SearchTrigger from "@/components/search/SearchTrigger";
import SearchProvider from "@/components/search/SearchProvider";
import NotificationBell from "@/components/notifications/NotificationBell";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import SidebarNav from "@/components/SidebarNav";
import type { NavItem } from "@/components/SidebarNav";
import "./shell.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) redirect("/login");

  if (auth.role === Role.TECH) redirect("/tech");

  const navLinks: NavItem[] = [
    // ── Operations ──
    { kind: "divider", label: "Operations" },
    { kind: "link", href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
    { kind: "link", href: "/analytics", label: "Analytics", iconName: "TrendingUp" },
    { kind: "link", href: "/work-orders", label: "Work Orders", iconName: "ClipboardList" },
    { kind: "link", href: "/quotes", label: "Quotes", iconName: "FileText" },
    { kind: "link", href: "/invoices", label: "Invoices", iconName: "Receipt" },
    { kind: "link", href: "/visits", label: "Visit Execution", iconName: "CalendarCheck" },

    // ── Assets ──
    { kind: "divider", label: "Assets" },
    { kind: "link", href: "/customers", label: "Customers", iconName: "Users" },
    { kind: "link", href: "/sites", label: "Sites", iconName: "MapPin" },
    { kind: "link", href: "/assets", label: "Assets", iconName: "Cog" },
    { kind: "link", href: "/materials", label: "Materials", iconName: "Wrench" },

    // ── Reports ──
    { kind: "divider", label: "Reports" },
    { kind: "link", href: "/reports", label: "Reports", iconName: "BarChart3" },
    { kind: "link", href: "/pm-schedules", label: "PM Schedules", iconName: "Clock" },

    // ── Knowledge ──
    { kind: "divider", label: "Knowledge" },
    { kind: "link", href: "/knowledge-base", label: "Knowledge Base", iconName: "BookOpen" },
    { kind: "link", href: "/procedure-templates", label: "Procedure Templates", iconName: "FileCheck" },
    { kind: "link", href: "/standards-packs", label: "Standards Packs", iconName: "PackageCheck" },
    { kind: "link", href: "/help", label: "Help Center", iconName: "HelpCircle" },

    // ── Admin (ADMIN role only) ──
    ...(auth.role === Role.ADMIN ? [
      { kind: "divider" as const, label: "Admin" },
      { kind: "link" as const, href: "/users", label: "Users", iconName: "UserCog" },
      { kind: "link" as const, href: "/settings/audit-logs", label: "Audit Logs", iconName: "Shield" },
      { kind: "link" as const, href: "/settings", label: "Settings", iconName: "Settings" },
    ] : []),
  ];

  return (
    <div className="shell">
      <SidebarNav
        links={navLinks}
        searchSlot={<SearchTrigger />}
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
      <SearchProvider />
    </div>
  );
}
