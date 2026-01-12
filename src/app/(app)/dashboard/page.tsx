"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";

type DashboardStats = {
  workOrders: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    byType: { type: string; count: number }[];
  };
  quotes: {
    total: number;
    draft: number;
    sent: number;
    approved: number;
    pendingValue: number;
    approvedValue: number;
  };
  revenue: {
    completedWorkValue: number;
    pendingInvoices: number;
    thisMonthRevenue: number;
  };
  technicians: {
    total: number;
    activeToday: number;
    totalHoursThisWeek: number;
  };
  recentActivity: {
    id: string;
    type: "WORK_ORDER" | "QUOTE" | "TASK" | "SIGNATURE";
    description: string;
    timestamp: string;
    user?: string;
  }[];
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/dashboard/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load dashboard stats");
      setStats((await res.json()).data);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(val);

  if (loading) return <div className="page-container"><p>Loading dashboard...</p></div>;
  if (error) return <div className="page-container"><div className="page-alert error">{error}</div></div>;
  if (!stats) return <div className="page-container"><p>No data available</p></div>;

  return (
    <div className="page-container">
      <PageHeader 
        title="Dashboard" 
        subtitle="Overview of your service operations" 
      />

      {/* Quick Actions */}
      <div className="quick-actions" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Link href="/quotes" className="action-card">
          <div className="action-icon">📋</div>
          <div className="action-label">Create Quote</div>
        </Link>
        <Link href="/work-orders" className="action-card">
          <div className="action-icon">🔧</div>
          <div className="action-label">New Work Order</div>
        </Link>
        <Link href="/customers" className="action-card">
          <div className="action-icon">👥</div>
          <div className="action-label">Manage Customers</div>
        </Link>
        <Link href="/materials" className="action-card">
          <div className="action-icon">📦</div>
          <div className="action-label">Material Catalog</div>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
        
        {/* Work Orders Stats */}
        <div className="stat-card">
          <div className="stat-header">
            <h3>Work Orders</h3>
            <span className="stat-total">{stats.workOrders.total}</span>
          </div>
          <div className="stat-breakdown">
            <div className="stat-row">
              <span className="stat-label">Open</span>
              <span className="stat-value">{stats.workOrders.open}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">In Progress</span>
              <span className="stat-value status-blue">{stats.workOrders.inProgress}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Completed</span>
              <span className="stat-value status-green">{stats.workOrders.completed}</span>
            </div>
          </div>
          {stats.workOrders.byType.length > 0 && (
            <div className="stat-footer">
              {stats.workOrders.byType.map((t) => (
                <span key={t.type} className="stat-chip">
                  {t.type}: {t.count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quotes Stats */}
        <div className="stat-card">
          <div className="stat-header">
            <h3>Quotes</h3>
            <span className="stat-total">{stats.quotes.total}</span>
          </div>
          <div className="stat-breakdown">
            <div className="stat-row">
              <span className="stat-label">Draft</span>
              <span className="stat-value">{stats.quotes.draft}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Sent (Pending)</span>
              <span className="stat-value status-blue">{stats.quotes.sent}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Approved</span>
              <span className="stat-value status-green">{stats.quotes.approved}</span>
            </div>
          </div>
          <div className="stat-footer">
            <div>Pending: {formatCurrency(stats.quotes.pendingValue)}</div>
            <div>Approved: {formatCurrency(stats.quotes.approvedValue)}</div>
          </div>
        </div>

        {/* Revenue Stats */}
        <div className="stat-card highlight">
          <div className="stat-header">
            <h3>Revenue</h3>
            <span className="stat-total revenue">{formatCurrency(stats.revenue.thisMonthRevenue)}</span>
          </div>
          <div className="stat-breakdown">
            <div className="stat-row">
              <span className="stat-label">This Month</span>
              <span className="stat-value">{formatCurrency(stats.revenue.thisMonthRevenue)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Completed Work</span>
              <span className="stat-value">{formatCurrency(stats.revenue.completedWorkValue)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Pending Invoices</span>
              <span className="stat-value status-orange">{stats.revenue.pendingInvoices}</span>
            </div>
          </div>
        </div>

        {/* Technician Stats */}
        <div className="stat-card">
          <div className="stat-header">
            <h3>Technicians</h3>
            <span className="stat-total">{stats.technicians.total}</span>
          </div>
          <div className="stat-breakdown">
            <div className="stat-row">
              <span className="stat-label">Active Today</span>
              <span className="stat-value status-green">{stats.technicians.activeToday}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Hours This Week</span>
              <span className="stat-value">{stats.technicians.totalHoursThisWeek.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h3>Recent Activity</h3>
          <Link href="/work-orders" className="link-button">View All →</Link>
        </div>
        {stats.recentActivity.length === 0 ? (
          <p className="muted">No recent activity</p>
        ) : (
          <div className="activity-feed">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon">
                  {activity.type === "WORK_ORDER" && "🔧"}
                  {activity.type === "QUOTE" && "📋"}
                  {activity.type === "TASK" && "✓"}
                  {activity.type === "SIGNATURE" && "✍️"}
                </div>
                <div className="activity-content">
                  <div className="activity-description">{activity.description}</div>
                  <div className="activity-meta">
                    {activity.user && <span>{activity.user} • </span>}
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .quick-actions .action-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.2s;
          cursor: pointer;
        }
        .quick-actions .action-card:hover {
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }
        .action-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }
        .action-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }

        .stat-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 20px;
        }
        .stat-card.highlight {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-color: #2563eb;
          color: white;
        }
        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }
        .stat-card.highlight .stat-header {
          border-bottom-color: rgba(255,255,255,0.2);
        }
        .stat-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .stat-total {
          font-size: 32px;
          font-weight: 700;
        }
        .stat-total.revenue {
          color: #fff;
        }
        .stat-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stat-label {
          font-size: 13px;
          color: var(--text-muted);
        }
        .stat-card.highlight .stat-label {
          color: rgba(255,255,255,0.85);
        }
        .stat-value {
          font-size: 16px;
          font-weight: 600;
        }
        .stat-value.status-blue {
          color: #3b82f6;
        }
        .stat-value.status-green {
          color: #10b981;
        }
        .stat-value.status-orange {
          color: #f59e0b;
        }
        .stat-footer {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
          font-size: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .stat-card.highlight .stat-footer {
          border-top-color: rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.9);
        }
        .stat-chip {
          padding: 4px 8px;
          background: var(--background);
          border-radius: 4px;
          font-size: 11px;
        }

        .activity-feed {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .activity-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: var(--background);
          border-radius: 6px;
        }
        .activity-icon {
          font-size: 20px;
          line-height: 1;
        }
        .activity-content {
          flex: 1;
        }
        .activity-description {
          font-size: 14px;
          margin-bottom: 4px;
        }
        .activity-meta {
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
