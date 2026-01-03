import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

type NavLink = {
  href: string;
  label: string;
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) redirect("/login");

  // TECH uses the separate UI
  if (auth.role === Role.TECH) redirect("/tech");

  const navLinks: NavLink[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/customers", label: "Customers" },
    { href: "/sites", label: "Sites" },
    { href: "/assets", label: "Assets" },
    { href: "/work-orders", label: "Work Orders" },
    { href: "/visits", label: "Visit Execution" },
    { href: "/reports", label: "Reports" },
    { href: "/knowledge-base", label: "Knowledge Base" },
    ...(auth.role === Role.ADMIN ? [{ href: "/users", label: "Users" }] : []),
  ];

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

        <div style={{ marginTop: "auto" }}>
          <LogoutButton />
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
