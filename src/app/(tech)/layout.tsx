import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

type NavLink = { href: string; label: string };

const navLinks: NavLink[] = [{ href: "/tech", label: "My Work" }];

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) redirect("/login");

  // Non-tech should not use tech UI
  if (auth.role !== Role.TECH) redirect("/dashboard");

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1>Tech</h1>
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
