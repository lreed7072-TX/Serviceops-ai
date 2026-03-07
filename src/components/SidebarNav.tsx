"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Cog,
  ClipboardList,
  FileText,
  Receipt,
  CalendarCheck,
  BarChart3,
  Clock,
  BookOpen,
  FileCheck,
  PackageCheck,
  Wrench,
  UserCog,
  Shield,
  Settings,
  HelpCircle,
  Menu,
  X,
  TrendingUp,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  LayoutDashboard,
  Users,
  MapPin,
  Cog,
  ClipboardList,
  FileText,
  Receipt,
  CalendarCheck,
  BarChart3,
  Clock,
  BookOpen,
  FileCheck,
  PackageCheck,
  Wrench,
  UserCog,
  Shield,
  Settings,
  HelpCircle,
  TrendingUp,
};

export type NavLink = {
  kind: "link";
  href: string;
  label: string;
  iconName: string;
};

export type NavDivider = {
  kind: "divider";
  label?: string;
};

export type NavItem = NavLink | NavDivider;

interface SidebarNavProps {
  links: NavItem[];
  searchSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

export default function SidebarNav({ links, searchSlot, footerSlot }: SidebarNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      <div
        className={`sidebar-overlay${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />

      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand">
          <h1>ServiceOpsIQ</h1>
          <p className="brand-tagline">Field Service Management</p>
        </div>

        {searchSlot && (
          <div className="sidebar-search">{searchSlot}</div>
        )}

        <nav className="nav">
          {links.map((item, index) => {
            if (item.kind === "divider") {
              return (
                <div key={`divider-${index}`} className="nav-section-divider">
                  <div className="nav-divider" />
                  {item.label && (
                    <span className="nav-section-label">{item.label}</span>
                  )}
                </div>
              );
            }

            const Icon = iconMap[item.iconName];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">
                  {Icon ? <Icon size={18} /> : null}
                </span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {footerSlot && (
          <div className="sidebar-footer">{footerSlot}</div>
        )}
      </aside>
    </>
  );
}
