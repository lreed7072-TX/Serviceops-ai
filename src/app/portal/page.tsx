"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  customerName: string;
  openQuotes: number;
  unpaidInvoices: number;
  activeWorkOrders: number;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    status: string;
  }>;
}

export default function PortalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [profileRes, quotesRes, invoicesRes, workOrdersRes] = await Promise.all([
        fetch("/api/portal/profile"),
        fetch("/api/portal/quotes"),
        fetch("/api/portal/invoices"),
        fetch("/api/portal/work-orders"),
      ]);

      const profile = profileRes.ok ? await profileRes.json() : null;
      const quotes = quotesRes.ok ? await quotesRes.json() : { data: [] };
      const invoices = invoicesRes.ok ? await invoicesRes.json() : { data: [] };
      const workOrders = workOrdersRes.ok ? await workOrdersRes.json() : { data: [] };

      const openQuotes = (quotes.data || []).filter(
        (q: any) => q.status === "SENT"
      ).length;
      const unpaidInvoices = (invoices.data || []).filter(
        (i: any) => i.status === "SENT" || i.status === "OVERDUE"
      ).length;
      const activeWorkOrders = (workOrders.data || []).filter(
        (w: any) => w.status === "OPEN" || w.status === "IN_PROGRESS"
      ).length;

      // Build recent activity from all sources
      const activity: DashboardData["recentActivity"] = [];

      for (const q of (quotes.data || []).slice(0, 5)) {
        activity.push({
          id: q.id,
          type: "quote",
          title: `Quote ${q.quoteNumber} - ${q.title}`,
          date: q.createdAt,
          status: q.status,
        });
      }
      for (const i of (invoices.data || []).slice(0, 5)) {
        activity.push({
          id: i.id,
          type: "invoice",
          title: `Invoice ${i.invoiceNumber} - ${i.title}`,
          date: i.createdAt,
          status: i.status,
        });
      }
      for (const w of (workOrders.data || []).slice(0, 5)) {
        activity.push({
          id: w.id,
          type: "work-order",
          title: `${w.workOrderNumber || "WO"} - ${w.title}`,
          date: w.createdAt,
          status: w.status,
        });
      }

      activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setData({
        customerName: profile?.data?.customer?.name || "Customer",
        openQuotes,
        unpaidInvoices,
        activeWorkOrders,
        recentActivity: activity.slice(0, 10),
      });
    } catch {
      // Silently handle - layout will redirect if auth fails
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-loading">
        <div className="portal-spinner" />
        <span>Loading dashboard...</span>
      </div>
    );
  }

  if (!data) return null;

  const getStatusClass = (status: string) =>
    status?.toLowerCase().replace("_", "-") || "";

  const getActivityLink = (item: DashboardData["recentActivity"][0]) => {
    switch (item.type) {
      case "quote":
        return `/portal/quotes/${item.id}`;
      case "invoice":
        return `/portal/invoices/${item.id}`;
      case "work-order":
        return `/portal/work-orders/${item.id}`;
      default:
        return "#";
    }
  };

  const getActivityDotColor = (type: string) => {
    switch (type) {
      case "quote":
        return "var(--info)";
      case "invoice":
        return "var(--success)";
      case "work-order":
        return "var(--warning)";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div>
      <div className="portal-welcome">
        <h1>Welcome, {data.customerName}</h1>
        <p>View your quotes, invoices, and work order progress below.</p>
      </div>

      <div className="portal-summary-grid">
        <div className="portal-summary-card">
          <div className="portal-summary-value">{data.openQuotes}</div>
          <div className="portal-summary-label">Open Quotes</div>
        </div>
        <div className="portal-summary-card">
          <div className="portal-summary-value">{data.unpaidInvoices}</div>
          <div className="portal-summary-label">Unpaid Invoices</div>
        </div>
        <div className="portal-summary-card">
          <div className="portal-summary-value">{data.activeWorkOrders}</div>
          <div className="portal-summary-label">Active Work Orders</div>
        </div>
      </div>

      <div className="portal-card">
        <div className="portal-card-header">
          <h2>Recent Activity</h2>
        </div>
        <div className="portal-card-body">
          {data.recentActivity.length === 0 ? (
            <div className="portal-empty">
              <p>No recent activity.</p>
            </div>
          ) : (
            <ul className="portal-activity-list">
              {data.recentActivity.map((item) => (
                <li key={`${item.type}-${item.id}`} className="portal-activity-item">
                  <div
                    className="portal-activity-dot"
                    style={{ background: getActivityDotColor(item.type) }}
                  />
                  <div className="portal-activity-content">
                    <Link href={getActivityLink(item)} className="portal-activity-title">
                      {item.title}
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`portal-status ${getStatusClass(item.status)}`}>
                        {item.status.replace("_", " ")}
                      </span>
                      <span className="portal-activity-date">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
