"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import GenerateWorkOrderButton from "@/components/pm/GenerateWorkOrderButton";
import PMHistoryList from "@/components/pm/PMHistoryList";
import EditPMScheduleButton from "@/components/pm/EditPMScheduleButton";
import "./pm-detail.css";

interface PMScheduleDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  frequencyType: string;
  frequencyValue: number;
  nextScheduledDate: string | null;
  lastGeneratedDate: string | null;
  autoGenerateWorkOrders: boolean;
  workOrderTitle: string | null;
  estimatedHours: number | null;
  priority: string;
  executionCount: number;
  createdAt: string;
  complianceRate: number;
  asset: { id: string; name: string; serialNumber: string | null };
  site: { id: string; name: string };
  customer: { id: string; name: string };
  procedureTemplate: { id: string; name: string; description: string | null } | null;
  lastGeneratedWorkOrder: {
    id: string;
    workOrderNumber: string | null;
    status: string;
    dueDate: string | null;
  } | null;
  generatedWorkOrders: {
    id: string;
    workOrderNumber: string;
    title: string;
    status: string;
    dueDate: string | null;
    completedAt: string | null;
    createdAt: string;
  }[];
  createdBy: { id: string; name: string } | null;
}

export default function PMScheduleDetailPage() {
  const params = useParams();
  const scheduleId = params?.id as string;
  const [schedule, setSchedule] = useState<PMScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = async () => {
    try {
      const res = await apiFetch(`/api/pm-schedules/${scheduleId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("PM schedule not found");
      }
      const json = await res.json();
      setSchedule(json.data);
    } catch {
      setError("PM schedule not found or you don't have access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scheduleId) fetchSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  if (loading) {
    return (
      <div className="page-container">
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
          Loading PM schedule...
        </p>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="page-container">
        <div className="pm-error-state">
          <h1>PM Schedule Not Found</h1>
          <p>{error || "The PM schedule doesn't exist or you don't have access."}</p>
          <Link href="/pm-schedules" className="btn btn-primary">
            Back to PM Schedules
          </Link>
        </div>
      </div>
    );
  }

  // Calculate days until next
  let daysUntilNext: number | null = null;
  let nextStatus = "upcoming";
  if (schedule.nextScheduledDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(schedule.nextScheduledDate);
    nextDate.setHours(0, 0, 0, 0);
    daysUntilNext = Math.ceil(
      (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilNext < 0) nextStatus = "overdue";
    else if (daysUntilNext === 0) nextStatus = "due-today";
    else if (daysUntilNext <= 7) nextStatus = "due-soon";
  }

  const getFrequencyLabel = () => {
    const freqLabels: Record<string, string> = {
      DAILY: "day",
      WEEKLY: "week",
      MONTHLY: "month",
      YEARLY: "year",
    };
    const unit = freqLabels[schedule.frequencyType] || schedule.frequencyType.toLowerCase();
    if (schedule.frequencyValue === 1) return `Every ${unit}`;
    return `Every ${schedule.frequencyValue} ${unit}s`;
  };

  const completedCount = schedule.generatedWorkOrders.filter(
    (wo) => wo.status === "COMPLETED"
  ).length;

  return (
    <div className="page-container pm-detail-page">
      {/* Breadcrumb */}
      <div className="pm-breadcrumb">
        <Link href="/pm-schedules">PM Schedules</Link>
        <span>/</span>
        <span>{schedule.name}</span>
      </div>

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="schedule-meta-header">
            <span className={`status-badge badge-${schedule.status === "ACTIVE" ? "active" : schedule.status === "DRAFT" ? "paused" : "archived"}`}>
              {schedule.status}
            </span>
            {daysUntilNext !== null && (
              <span className={`due-badge ${nextStatus}`}>
                {nextStatus === "overdue" && `${Math.abs(daysUntilNext)}d Overdue`}
                {nextStatus === "due-today" && "Due Today"}
                {nextStatus === "due-soon" && `Due in ${daysUntilNext}d`}
                {nextStatus === "upcoming" && `Due in ${daysUntilNext}d`}
              </span>
            )}
          </div>
          <h1>{schedule.name}</h1>
          {schedule.description && (
            <p className="page-subtitle">{schedule.description}</p>
          )}
        </div>
        <div className="header-actions">
          <EditPMScheduleButton scheduleId={schedule.id} />
          {schedule.status === "ACTIVE" && (
            <GenerateWorkOrderButton
              scheduleId={schedule.id}
              scheduleName={schedule.name}
              onGenerated={fetchSchedule}
            />
          )}
        </div>
      </div>

      {/* Detail Grid */}
      <div className="pm-detail-grid">
        {/* Left Column */}
        <div className="pm-detail-main">
          {/* Equipment Info */}
          <section className="pm-detail-section">
            <h2>Equipment Information</h2>
            <div className="pm-info-grid">
              <div className="pm-info-item">
                <label>Equipment</label>
                <Link href={`/assets/${schedule.asset.id}`} className="pm-info-link">
                  {schedule.asset.name}
                </Link>
              </div>
              {schedule.asset.serialNumber && (
                <div className="pm-info-item">
                  <label>Serial Number</label>
                  <span>{schedule.asset.serialNumber}</span>
                </div>
              )}
              <div className="pm-info-item">
                <label>Customer</label>
                <Link href={`/customers/${schedule.customer.id}`} className="pm-info-link">
                  {schedule.customer.name}
                </Link>
              </div>
              <div className="pm-info-item">
                <label>Site</label>
                <span>{schedule.site.name}</span>
              </div>
            </div>
          </section>

          {/* Schedule Settings */}
          <section className="pm-detail-section">
            <h2>Schedule Settings</h2>
            <div className="pm-info-grid">
              <div className="pm-info-item">
                <label>Frequency</label>
                <span className="frequency-display">{getFrequencyLabel()}</span>
              </div>
              <div className="pm-info-item">
                <label>Next Scheduled</label>
                <span>
                  {schedule.nextScheduledDate
                    ? new Date(schedule.nextScheduledDate).toLocaleDateString()
                    : "Not scheduled"}
                </span>
              </div>
              <div className="pm-info-item">
                <label>Auto-Generate WOs</label>
                <span>
                  {schedule.autoGenerateWorkOrders ? (
                    <span className="status-yes">Enabled</span>
                  ) : (
                    <span className="status-no">Disabled</span>
                  )}
                </span>
              </div>
              <div className="pm-info-item">
                <label>Priority</label>
                <span className={`priority-badge priority-${schedule.priority.toLowerCase()}`}>
                  {schedule.priority}
                </span>
              </div>
              {schedule.estimatedHours && (
                <div className="pm-info-item">
                  <label>Estimated Hours</label>
                  <span>{schedule.estimatedHours}h</span>
                </div>
              )}
              {schedule.procedureTemplate && (
                <div className="pm-info-item">
                  <label>Procedure Template</label>
                  <Link
                    href={`/procedure-templates/${schedule.procedureTemplate.id}`}
                    className="pm-info-link"
                  >
                    {schedule.procedureTemplate.name}
                  </Link>
                </div>
              )}
            </div>
          </section>

          {/* Work Order History */}
          <section className="pm-detail-section">
            <h2>Generated Work Orders ({schedule.generatedWorkOrders.length})</h2>
            <PMHistoryList workOrders={schedule.generatedWorkOrders} />
          </section>
        </div>

        {/* Right Column - Sidebar */}
        <div className="pm-detail-sidebar">
          {/* Compliance Stats */}
          <div className="pm-sidebar-card">
            <h3>Compliance</h3>
            <div className="compliance-display">
              <div className="compliance-circle">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle"
                    strokeDasharray={`${schedule.complianceRate}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" className="percentage">
                    {schedule.complianceRate}%
                  </text>
                </svg>
              </div>
              <p className="compliance-label">
                {completedCount} of {schedule.generatedWorkOrders.length} completed
              </p>
            </div>
          </div>

          {/* Execution Stats */}
          <div className="pm-sidebar-card">
            <h3>Statistics</h3>
            <div className="pm-stats-list">
              <div className="pm-stat-item">
                <span className="pm-stat-label">Total Generated</span>
                <span className="pm-stat-value">{schedule.executionCount || 0}</span>
              </div>
              <div className="pm-stat-item">
                <span className="pm-stat-label">Last Generated</span>
                <span className="pm-stat-value">
                  {schedule.lastGeneratedDate
                    ? new Date(schedule.lastGeneratedDate).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
              {schedule.lastGeneratedWorkOrder && (
                <div className="pm-stat-item">
                  <span className="pm-stat-label">Last WO</span>
                  <Link
                    href={`/work-orders/${schedule.lastGeneratedWorkOrder.id}`}
                    className="pm-stat-link"
                  >
                    {schedule.lastGeneratedWorkOrder.workOrderNumber || "View"}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Created By */}
          <div className="pm-sidebar-card">
            <h3>Created By</h3>
            {schedule.createdBy ? (
              <div className="created-by-info">
                <div className="user-avatar-circle">
                  {schedule.createdBy.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <strong>{schedule.createdBy.name}</strong>
                  <span className="created-date">
                    {new Date(schedule.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ) : (
              <p className="no-info">No information</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
