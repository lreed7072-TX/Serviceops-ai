"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  status: string;
  sequenceNumber: number | null;
}

interface Visit {
  id: string;
  visitNumber: string | null;
  status: string;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
}

interface WorkOrderDetail {
  id: string;
  workOrderNumber: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  site: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  tasks: Task[];
  visits: Visit[];
  progress: {
    total: number;
    completed: number;
    percent: number;
  };
}

export default function PortalWorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const woId = params?.id as string;
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (woId) {
      fetch(`/api/portal/work-orders/${woId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => setWorkOrder(data.data))
        .catch(() => router.push("/portal/work-orders"))
        .finally(() => setLoading(false));
    }
  }, [woId, router]);

  const getStatusClass = (status: string) =>
    status?.toLowerCase().replace("_", "-") || "";

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case "DONE":
      case "VERIFIED":
        return "\u2713";
      case "IN_PROGRESS":
        return "\u25CB";
      default:
        return "\u2014";
    }
  };

  if (loading) {
    return (
      <div className="portal-loading">
        <div className="portal-spinner" />
        <span>Loading work order...</span>
      </div>
    );
  }

  if (!workOrder) return null;

  return (
    <div>
      <Link href="/portal/work-orders" style={{ color: "var(--text-light)", textDecoration: "none", fontSize: "0.875rem" }}>
        ← Back to Work Orders
      </Link>

      <div className="portal-detail-header" style={{ marginTop: "var(--space-md)" }}>
        <div>
          <div className="portal-detail-title">{workOrder.title}</div>
          <div className="portal-detail-number">
            {workOrder.workOrderNumber || "Work Order"}
            <span className={`portal-status ${getStatusClass(workOrder.status)}`} style={{ marginLeft: "12px" }}>
              {workOrder.status.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      <div className="portal-detail-meta">
        {workOrder.site && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Site</span>
            <span className="portal-detail-meta-value">
              {workOrder.site.name}
              {workOrder.site.city && `, ${workOrder.site.city}`}
              {workOrder.site.state && `, ${workOrder.site.state}`}
            </span>
          </div>
        )}
        <div className="portal-detail-meta-item">
          <span className="portal-detail-meta-label">Created</span>
          <span className="portal-detail-meta-value">
            {new Date(workOrder.createdAt).toLocaleDateString()}
          </span>
        </div>
        {workOrder.priority && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Priority</span>
            <span className="portal-detail-meta-value">{workOrder.priority}</span>
          </div>
        )}
        {workOrder.dueDate && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Due Date</span>
            <span className="portal-detail-meta-value">
              {new Date(workOrder.dueDate).toLocaleDateString()}
            </span>
          </div>
        )}
        {workOrder.completedAt && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Completed</span>
            <span className="portal-detail-meta-value" style={{ color: "var(--success)" }}>
              {new Date(workOrder.completedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {workOrder.description && (
        <div className="portal-card" style={{ marginBottom: "var(--space-md)" }}>
          <div className="portal-card-body">
            <p style={{ color: "var(--text-light)", fontSize: "0.9375rem" }}>{workOrder.description}</p>
          </div>
        </div>
      )}

      {/* Task Progress */}
      {workOrder.tasks.length > 0 && (
        <div className="portal-card" style={{ marginBottom: "var(--space-md)" }}>
          <div className="portal-card-header">
            <h2>Task Progress</h2>
            <span style={{ fontSize: "0.875rem", color: "var(--text-light)" }}>
              {workOrder.progress.completed} of {workOrder.progress.total} complete
            </span>
          </div>
          <div className="portal-card-body">
            <div className="portal-progress-bar" style={{ marginBottom: "var(--space-md)" }}>
              <div
                className="portal-progress-fill"
                style={{ width: `${workOrder.progress.percent}%` }}
              />
            </div>
            <div className="portal-progress-label" style={{ textAlign: "center", marginBottom: "var(--space-md)" }}>
              {workOrder.progress.percent}% Complete
            </div>

            <table className="portal-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th>Task</th>
                  <th style={{ width: "100px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.tasks.map((task, idx) => (
                  <tr key={task.id}>
                    <td style={{ color: "var(--text-muted)" }}>{task.sequenceNumber || idx + 1}</td>
                    <td>{task.title}</td>
                    <td>
                      <span className={`portal-status ${getStatusClass(task.status)}`}>
                        {getTaskStatusIcon(task.status)} {task.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visit History */}
      {workOrder.visits.length > 0 && (
        <div className="portal-card">
          <div className="portal-card-header">
            <h2>Visit History</h2>
          </div>
          <div className="portal-card-body">
            {workOrder.visits.map((visit) => (
              <div key={visit.id} className="portal-visit-item">
                <div className="portal-visit-header">
                  <span className="portal-visit-number">
                    {visit.visitNumber || "Visit"}
                  </span>
                  <span className={`portal-status ${getStatusClass(visit.status)}`}>
                    {visit.status.replace("_", " ")}
                  </span>
                </div>
                <div className="portal-visit-date">
                  {visit.scheduledFor
                    ? `Scheduled: ${new Date(visit.scheduledFor).toLocaleDateString()}`
                    : ""}
                  {visit.completedAt
                    ? ` | Completed: ${new Date(visit.completedAt).toLocaleDateString()}`
                    : ""}
                </div>
                {visit.summary && (
                  <p className="portal-visit-summary">{visit.summary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
