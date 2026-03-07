"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Phone,
  CalendarClock,
  DollarSign,
  Ticket,
  PhoneOutgoing,
  CalendarPlus,
  PlusCircle,
  Clock,
  User,
  TrendingUp,
} from "lucide-react";
import "./dashboard.css";

type CallLog = {
  id: string;
  customerName: string;
  outcome: string;
  createdAt: string;
};

type PipelineStage = {
  stage: string;
  count: number;
  value: number;
};

type SalesDashboardData = {
  callsThisWeek: number;
  openFollowUps: number;
  overdueFollowUps: number;
  pipelineValue: number;
  openServiceTickets: number;
  recentCalls: CallLog[];
  pipelineByStage: PipelineStage[];
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SalesDashboardPage() {
  const [data, setData] = useState<SalesDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/api/crm/dashboard", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load sales dashboard");
        const json = await res.json();
        setData(json.data);
      } catch (e: any) {
        const msg = e?.message || "Failed to load dashboard";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="sales-dashboard">
        <div className="sales-loading-container">
          <div className="sales-loading-spinner"></div>
          <span>Loading sales dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sales-dashboard">
        <div className="sales-error-container">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="sales-dashboard">
        <div className="sales-empty-state">No data available</div>
      </div>
    );
  }

  return (
    <div className="sales-dashboard">
      {/* Page Header */}
      <div className="sales-dashboard-header">
        <h1>Sales Dashboard</h1>
        <p className="sales-dashboard-subtitle">
          Your CRM at a glance
        </p>
      </div>

      {/* Stat Cards */}
      <div className="sales-stat-grid">
        <div className="sales-stat-card">
          <div className="sales-stat-icon blue">
            <Phone size={22} />
          </div>
          <div className="sales-stat-content">
            <h3 className="sales-stat-value">{data.callsThisWeek}</h3>
            <p className="sales-stat-label">Calls This Week</p>
          </div>
        </div>

        <div className="sales-stat-card">
          <div className="sales-stat-icon orange">
            <CalendarClock size={22} />
          </div>
          <div className="sales-stat-content">
            <h3 className="sales-stat-value">{data.openFollowUps}</h3>
            <p className="sales-stat-label">Open Follow-ups</p>
            {data.overdueFollowUps > 0 && (
              <p className="sales-stat-overdue">
                {data.overdueFollowUps} overdue
              </p>
            )}
          </div>
        </div>

        <div className="sales-stat-card">
          <div className="sales-stat-icon green">
            <DollarSign size={22} />
          </div>
          <div className="sales-stat-content">
            <h3 className="sales-stat-value">
              {formatCurrency(data.pipelineValue)}
            </h3>
            <p className="sales-stat-label">Pipeline Value</p>
          </div>
        </div>

        <div className="sales-stat-card">
          <div className="sales-stat-icon red">
            <Ticket size={22} />
          </div>
          <div className="sales-stat-content">
            <h3 className="sales-stat-value">{data.openServiceTickets}</h3>
            <p className="sales-stat-label">Open Tickets</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="sales-quick-actions">
        <Link href="/sales/calls/new" className="sales-action-btn">
          <PhoneOutgoing size={18} />
          Log a Call
        </Link>
        <Link href="/sales/follow-ups" className="sales-action-btn">
          <CalendarPlus size={18} />
          Create Follow-up
        </Link>
        <Link href="/sales/service-tickets/new" className="sales-action-btn">
          <PlusCircle size={18} />
          New Service Ticket
        </Link>
      </div>

      {/* Two-Column Layout */}
      <div className="sales-two-col">
        {/* Recent Activity */}
        <div className="sales-section-card">
          <div className="sales-section-header">
            <h3>Recent Activity</h3>
            <Link href="/sales/calls" className="sales-section-link">
              View All
            </Link>
          </div>
          <div className="sales-section-body">
            {data.recentCalls.length === 0 ? (
              <div className="sales-empty-list">No recent calls</div>
            ) : (
              <div className="sales-activity-list">
                {data.recentCalls.slice(0, 10).map((call) => (
                  <div key={call.id} className="sales-activity-item">
                    <div className="sales-activity-icon">
                      <User size={14} />
                    </div>
                    <div className="sales-activity-content">
                      <div className="sales-activity-name">
                        {call.customerName}
                      </div>
                      <div className="sales-activity-outcome">
                        {call.outcome}
                      </div>
                    </div>
                    <div className="sales-activity-time">
                      <Clock size={12} />
                      <span>{formatRelativeTime(call.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline by Stage */}
        <div className="sales-section-card">
          <div className="sales-section-header">
            <h3>Pipeline by Stage</h3>
            <Link href="/sales/opportunities" className="sales-section-link">
              View Pipeline
            </Link>
          </div>
          <div className="sales-section-body">
            {data.pipelineByStage.length === 0 ? (
              <div className="sales-empty-list">No pipeline data</div>
            ) : (
              <div className="sales-pipeline-list">
                <div className="sales-pipeline-header-row">
                  <span className="sales-pipeline-col-stage">Stage</span>
                  <span className="sales-pipeline-col-count">Count</span>
                  <span className="sales-pipeline-col-value">Value</span>
                </div>
                {data.pipelineByStage.map((stage, idx) => (
                  <div key={idx} className="sales-pipeline-row">
                    <span className="sales-pipeline-col-stage">
                      <TrendingUp size={14} />
                      {stage.stage}
                    </span>
                    <span className="sales-pipeline-col-count">
                      {stage.count}
                    </span>
                    <span className="sales-pipeline-col-value">
                      {formatCurrency(stage.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
