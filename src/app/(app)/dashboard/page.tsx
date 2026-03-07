"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { DollarSign, Wrench, FileText, ClipboardList, Users, CheckCircle, PenTool, Activity } from "lucide-react";
import "./dashboard.css";

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
    thisMonthInvoiced: number;
    totalBilled: number;
    paidRevenue: number;
    pendingRevenue: number;
  };
  invoices: {
    total: number;
    draft: number;
    sent: number;
    paid: number;
    overdue: number;
  };
  technicians: {
    total: number;
    activeToday: number;
    totalHoursThisWeek: number;
  };
  ai: {
    generated: number;
    approved: number;
    rejected: number;
  };
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    blocked: number;
    completionRate: number;
  };
  packages: {
    total: number;
    byType: { type: string; count: number }[];
  };
  recentActivity: {
    id: string;
    type: "WORK_ORDER" | "QUOTE" | "TASK" | "SIGNATURE";
    description: string;
    timestamp: string;
    user?: string;
  }[];
  charts: {
    revenueByMonth: { month: string; revenue: number }[];
    workOrdersByStatus: { name: string; value: number; color: string }[];
    topCustomers: { name: string; revenue: number }[];
  };
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/stats", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load dashboard stats");
      setStats((await res.json()).data);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  const formatShortCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="error-container">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-page">
        <div className="empty-state">No data available</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">
          Overview of your service operations
        </p>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link href="/quotes/new" className="action-card">
          <div className="action-icon"><ClipboardList size={20} /></div>
          <div className="action-label">Create Quote</div>
        </Link>
        <Link href="/work-orders/new" className="action-card">
          <div className="action-icon"><Wrench size={20} /></div>
          <div className="action-label">New Work Order</div>
        </Link>
        <Link href="/customers" className="action-card">
          <div className="action-icon"><Users size={20} /></div>
          <div className="action-label">Manage Customers</div>
        </Link>
        <Link href="/invoices" className="action-card">
          <div className="action-icon"><FileText size={20} /></div>
          <div className="action-label">View Invoices</div>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-icon revenue"><DollarSign size={20} /></div>
          <div className="kpi-content">
            <h3 className="kpi-value">{formatCurrency(stats.revenue.paidRevenue)}</h3>
            <p className="kpi-label">Total Revenue</p>
            <p className="kpi-change positive">
              {formatCurrency(stats.revenue.thisMonthInvoiced)} this month
            </p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon workorders"><Wrench size={20} /></div>
          <div className="kpi-content">
            <h3 className="kpi-value">{stats.workOrders.open + stats.workOrders.inProgress}</h3>
            <p className="kpi-label">Active Work Orders</p>
            <p className="kpi-change">
              {stats.workOrders.open} open, {stats.workOrders.inProgress} in progress
            </p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon invoices"><FileText size={20} /></div>
          <div className="kpi-content">
            <h3 className="kpi-value">{stats.invoices.sent + stats.invoices.overdue}</h3>
            <p className="kpi-label">Pending Invoices</p>
            <p className="kpi-change negative">
              {stats.invoices.overdue > 0 ? `${stats.invoices.overdue} overdue` : "None overdue"}
            </p>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon quotes"><ClipboardList size={20} /></div>
          <div className="kpi-content">
            <h3 className="kpi-value">{stats.quotes.sent}</h3>
            <p className="kpi-label">Open Quotes</p>
            <p className="kpi-change">
              {formatCurrency(stats.quotes.pendingValue)} pending
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Revenue Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Revenue (Last 6 Months)</h3>
          </div>
          <div className="chart-body">
            {stats.charts.revenueByMonth.some((d) => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.charts.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tickFormatter={formatShortCurrency}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value || 0)), "Revenue"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No revenue data yet</div>
            )}
          </div>
        </div>

        {/* Work Orders by Status */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Work Orders by Status</h3>
          </div>
          <div className="chart-body">
            {stats.charts.workOrdersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.charts.workOrdersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {stats.charts.workOrdersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [Number(value || 0), String(name)]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No work orders yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Stats and Activity Row */}
      <div className="stats-section">
        {/* Top Customers */}
        <div className="stat-card">
          <div className="stat-header">
            <h3>Top Customers</h3>
          </div>
          {stats.charts.topCustomers.length > 0 ? (
            <div className="customers-list">
              {stats.charts.topCustomers.map((customer, idx) => (
                <div key={idx} className="customer-item">
                  <span className="customer-name">{customer.name}</span>
                  <span className="customer-revenue">
                    {formatCurrency(customer.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No customer data</div>
          )}
        </div>

        {/* Technicians */}
        <div className="stat-card">
          <div className="stat-header">
            <h3>Technicians</h3>
            <span className="stat-total">{stats.technicians.total}</span>
          </div>
          <div className="stat-breakdown">
            <div className="stat-row">
              <span className="stat-label">Active Today</span>
              <span className="stat-value green">{stats.technicians.activeToday}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Hours This Week</span>
              <span className="stat-value">{stats.technicians.totalHoursThisWeek.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="stat-card">
          <div className="stat-header">
            <h3>Tasks</h3>
            <span className="stat-total">{stats.tasks.total}</span>
          </div>
          <div className="stat-breakdown">
            <div className="stat-row">
              <span className="stat-label">Done</span>
              <span className="stat-value green">{stats.tasks.done}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">In Progress</span>
              <span className="stat-value blue">{stats.tasks.inProgress}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Blocked</span>
              <span className="stat-value red">{stats.tasks.blocked}</span>
            </div>
          </div>
          <div className="stat-footer">
            Completion Rate: {stats.tasks.completionRate}%
          </div>
        </div>

        {/* AI Stats */}
        <div className="stat-card ai-card">
          <div className="stat-header">
            <h3>AI Generation</h3>
            <span className="stat-total">{stats.ai.approved}</span>
          </div>
          <div className="stat-breakdown">
            <div className="stat-row">
              <span className="stat-label">Generated</span>
              <span className="stat-value">{stats.ai.generated}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Approved</span>
              <span className="stat-value">{stats.ai.approved}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Rejected</span>
              <span className="stat-value">{stats.ai.rejected}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <div className="activity-header">
          <h3>Recent Activity</h3>
          <Link href="/work-orders" className="activity-link">
            View All
          </Link>
        </div>
        <div className="activity-body">
          {stats.recentActivity.length === 0 ? (
            <div className="activity-empty">No recent activity</div>
          ) : (
            <div className="activity-list">
              {stats.recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === "WORK_ORDER" && <Wrench size={14} />}
                    {activity.type === "QUOTE" && <ClipboardList size={14} />}
                    {activity.type === "TASK" && <CheckCircle size={14} />}
                    {activity.type === "SIGNATURE" && <PenTool size={14} />}
                  </div>
                  <div className="activity-content">
                    <div className="activity-description">{activity.description}</div>
                    <div className="activity-meta">
                      {activity.user && <span>{activity.user} - </span>}
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
