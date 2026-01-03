import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

type NavLink = { href: string; label: string };

const navLinks: NavLink[] = [
  { href: "/tech", label: "My Work" },
];

export default function TechLayout({ children }: { children: React.ReactNode }) {
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
