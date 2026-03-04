import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getAuthContextFromSupabase } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { TechLayoutClient } from "@/components/TechLayoutClient";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";

type NavLink = { href: string; label: string };

const navLinks: NavLink[] = [
  { href: "/tech", label: "My Work" },
  { href: "/tech/photos", label: "📷 Photo Library" },
];

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContextFromSupabase();
  if (!auth) redirect("/login");

  // Allow TECH and ADMIN to access tech UI (ADMIN for testing/oversight)
  if (auth.role !== Role.TECH && auth.role !== Role.ADMIN) redirect("/dashboard");

  return (
    <div className="shell">
      <OfflineIndicator />
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

      <main className="main">
          <TechLayoutClient>{children}</TechLayoutClient>
        </main>
    </div>
  );
}
