"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import "./portal.css";

interface PortalContext {
  customer: { id: string; name: string };
  org: { id: string; name: string; logoUrl: string | null };
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [portal, setPortal] = useState<PortalContext | null>(null);
  const [loading, setLoading] = useState(true);

  // Login page doesn't need auth check
  const isLoginPage = pathname === "/portal/login";

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    // Verify portal auth by fetching profile
    fetch("/api/portal/profile")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        setPortal({
          customer: data.data.customer,
          org: data.data.org,
        });
      })
      .catch(() => {
        router.push("/portal/login");
      })
      .finally(() => setLoading(false));
  }, [isLoginPage, router]);

  // Login page renders without the portal chrome
  if (isLoginPage) {
    return <div className="portal-layout">{children}</div>;
  }

  if (loading) {
    return (
      <div className="portal-layout">
        <div className="portal-loading">
          <div className="portal-spinner" />
          <span>Loading portal...</span>
        </div>
      </div>
    );
  }

  if (!portal) return null;

  const handleLogout = () => {
    document.cookie = "portal_token=; path=/; max-age=0";
    router.push("/portal/login");
  };

  const navLinks = [
    { href: "/portal", label: "Dashboard" },
    { href: "/portal/quotes", label: "Quotes" },
    { href: "/portal/invoices", label: "Invoices" },
    { href: "/portal/work-orders", label: "Work Orders" },
  ];

  const isActive = (href: string) => {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  };

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="portal-header-left">
          {portal.org.logoUrl && (
            <img
              src={portal.org.logoUrl}
              alt={portal.org.name}
              className="portal-org-logo"
            />
          )}
          <span className="portal-org-name">{portal.org.name}</span>
          <span className="portal-customer-badge">{portal.customer.name}</span>
        </div>
        <div className="portal-header-right">
          <button onClick={handleLogout} className="portal-logout-btn">
            Sign Out
          </button>
        </div>
      </header>

      <nav className="portal-nav">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`portal-nav-link ${isActive(link.href) ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <main className="portal-main">{children}</main>
    </div>
  );
}
