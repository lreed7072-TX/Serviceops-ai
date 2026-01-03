import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

type NavLink = {
  href: string;
  label: string;
};

const navLinks: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/sites", label: "Sites" },
  { href: "/assets", label: "Assets" },
  { href: "/work-orders", label: "Work Orders" },
  { href: "/visits", label: "Visit Execution" },
  { href: "/reports", label: "Reports" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/users", label: "Users" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <h1>Field Service AI</h1>
        <nav className="nav">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
          <div style={{ paddingTop: 12 }}>
            <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "12px 0" }} />
            <LogoutButton />
          </div>

      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
