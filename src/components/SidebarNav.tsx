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
  Menu,
  X,
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
};

type NavLink = {
  href: string;
  label: string;
  iconName: string;
};

interface SidebarNavProps {
  links: NavLink[];
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
          {links.map((link) => {
            const Icon = iconMap[link.iconName];
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive(link.href) ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                <span className="nav-icon">
                  {Icon ? <Icon size={18} /> : null}
                </span>
                <span className="nav-label">{link.label}</span>
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
