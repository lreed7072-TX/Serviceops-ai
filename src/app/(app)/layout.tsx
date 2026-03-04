import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import SearchTrigger from "@/components/search/SearchTrigger";
import SearchProvider from "@/components/search/SearchProvider";
import NotificationBell from "@/components/notifications/NotificationBell";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import "./shell.css";

type NavLink = {
  href: string;
  label: string;
  icon: string;
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) redirect("/login");

  // TECH uses the separate UI
  if (auth.role === Role.TECH) redirect("/tech");

  const navLinks: NavLink[] = [
    { href: "/dashboard", label: "Dashboard", icon: "D" },
    { href: "/customers", label: "Customers", icon: "C" },
    { href: "/sites", label: "Sites", icon: "S" },
    { href: "/assets", label: "Assets", icon: "A" },
    { href: "/work-orders", label: "Work Orders", icon: "W" },
    { href: "/quotes", label: "Quotes", icon: "Q" },
    { href: "/invoices", label: "Invoices", icon: "I" },
    { href: "/visits", label: "Visit Execution", icon: "V" },
    { href: "/reports", label: "Reports", icon: "R" },
    { href: "/pm-schedules", label: "PM Schedules", icon: "P" },
    { href: "/knowledge-base", label: "Knowledge Base", icon: "K" },
    { href: "/procedure-templates", label: "Procedure Templates", icon: "T" },
    { href: "/standards-packs", label: "Standards Packs", icon: "X" },
    { href: "/materials", label: "Materials", icon: "M" },
    ...(auth.role === Role.ADMIN ? [
      { href: "/users", label: "Users", icon: "U" },
      { href: "/settings/audit-logs", label: "Audit Logs", icon: "L" },
      { href: "/settings", label: "Settings", icon: "G" },
    ] : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>ServiceOpsIQ</h1>
          <p className="brand-tagline">Field Service Management</p>
        </div>

        <div className="sidebar-search">
          <SearchTrigger />
        </div>

        <nav className="nav">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NotificationBell />
          <LogoutButton />
        </div>
      </aside>

      <main className="main">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <SearchProvider />
    </div>
  );
}
