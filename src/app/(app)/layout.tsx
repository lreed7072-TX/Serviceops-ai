import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import SearchTrigger from "@/components/search/SearchTrigger";
import SearchProvider from "@/components/search/SearchProvider";
import NotificationBell from "@/components/notifications/NotificationBell";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import SidebarNav from "@/components/SidebarNav";
import "./shell.css";

type NavLink = {
  href: string;
  label: string;
  iconName: string;
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) redirect("/login");

  if (auth.role === Role.TECH) redirect("/tech");

  const navLinks: NavLink[] = [
    { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
    { href: "/customers", label: "Customers", iconName: "Users" },
    { href: "/sites", label: "Sites", iconName: "MapPin" },
    { href: "/assets", label: "Assets", iconName: "Cog" },
    { href: "/work-orders", label: "Work Orders", iconName: "ClipboardList" },
    { href: "/quotes", label: "Quotes", iconName: "FileText" },
    { href: "/invoices", label: "Invoices", iconName: "Receipt" },
    { href: "/visits", label: "Visit Execution", iconName: "CalendarCheck" },
    { href: "/reports", label: "Reports", iconName: "BarChart3" },
    { href: "/pm-schedules", label: "PM Schedules", iconName: "Clock" },
    { href: "/knowledge-base", label: "Knowledge Base", iconName: "BookOpen" },
    { href: "/procedure-templates", label: "Procedure Templates", iconName: "FileCheck" },
    { href: "/standards-packs", label: "Standards Packs", iconName: "PackageCheck" },
    { href: "/materials", label: "Materials", iconName: "Wrench" },
    ...(auth.role === Role.ADMIN ? [
      { href: "/users", label: "Users", iconName: "UserCog" },
      { href: "/settings/audit-logs", label: "Audit Logs", iconName: "Shield" },
      { href: "/settings", label: "Settings", iconName: "Settings" },
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
