"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import TaskStatusChanger from "@/components/tasks/TaskStatusChanger";
import EvidenceCapture from "@/components/tasks/EvidenceCapture";
import MeasurementEntry from "@/components/tasks/MeasurementEntry";
import "./task-detail.css";

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "SKIPPED";
  sequenceNumber: number | null;
  isCritical: boolean;
  requiresEvidence: boolean;
  createdAt: string;
  updatedAt: string;
  workOrder: {
    id: string;
    workOrderNumber: string | null;
    title: string;
    status: string;
    customer: { id: string; name: string } | null;
    site: { id: string; name: string } | null;
  };
  workPackage: {
    id: string;
    name: string;
    packageType: string;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  blockedBy: {
    id: string;
    title: string;
    status: string;
  } | null;
  blockingTasks: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  evidence: Array<{
    id: string;
    type: string;
    noteText: string | null;
    url: string | null;
    createdAt: string;
    createdByUser: { id: string; name: string | null; email: string };
  }>;
  measurements: Array<{
    id: string;
    name: string;
    measurementType: "NUMERIC" | "TEXT" | "PASS_FAIL";
    numericValue: number | null;
    textValue: string | null;
    passFail: boolean | null;
    unit: string | null;
    minValue: number | null;
    maxValue: number | null;
    isWithinSpec: boolean | null;
    capturedAt: string | null;
    capturedByUser: { id: string; name: string | null; email: string } | null;
  }>;
  materialUsages: Array<{
    id: string;
    name: string;
    partNumber: string | null;
    quantity: number;
    unit: string | null;
    unitCost: number | null;
    totalCost: number | null;
    addedByUser: { id: string; name: string | null } | null;
  }>;
  timeEntries: Array<{
    id: string;
    status: string;
    accumulatedSeconds: number;
    startedAt: string;
    stoppedAt: string | null;
    user: { id: string; name: string | null };
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  TODO: "gray",
  IN_PROGRESS: "blue",
  DONE: "green",
  BLOCKED: "red",
  SKIPPED: "orange",
};

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params?.id;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchTask = async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTask(json.data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="page-container task-detail-page">
        <div className="td-error-state">
          <p>Loading task...</p>
        </div>
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="page-container task-detail-page">
        <div className="td-error-state">
          <h1>Task Not Found</h1>
          <p>The task you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.</p>
          <Link href="/work-orders" className="btn btn-primary">
            Back to Work Orders
          </Link>
        </div>
      </div>
    );
  }

  const totalTimeSeconds = task.timeEntries.reduce(
    (sum, entry) => sum + (entry.accumulatedSeconds || 0),
    0
  );

  const statusColor = STATUS_COLORS[task.status] ?? "gray";
  const hasDependencies =
    task.blockedBy !== null || task.blockingTasks.length > 0;

  return (
    <div className="page-container task-detail-page">
      {/* Breadcrumb */}
      <div className="td-breadcrumb">
        <Link href="/work-orders">Work Orders</Link>
        <span>/</span>
        <Link href={`/work-orders/${task.workOrder.id}`}>
          {task.workOrder.workOrderNumber || "Work Order"}
        </Link>
        <span>/</span>
        <span>Task #{task.sequenceNumber ?? "---"}</span>
      </div>

      {/* Header */}
      <div className="td-header">
        <div className="td-header-left">
          <div className="td-meta-row">
            {task.sequenceNumber != null && (
              <span className="td-seq-badge">#{task.sequenceNumber}</span>
            )}
            <span className={`td-status-badge ${statusColor}`}>
              {task.status.replace(/_/g, " ")}
            </span>
            {task.isCritical && (
              <span className="td-critical-badge">Critical</span>
            )}
          </div>
          <h1>{task.title}</h1>
          <p className="td-header-subtitle">
            {task.workOrder.customer?.name}
            {task.workOrder.site && ` \u2022 ${task.workOrder.site.name}`}
          </p>
        </div>
        <div className="td-header-actions">
          <TaskStatusChanger
            taskId={task.id}
            currentStatus={task.status}
            onStatusChanged={fetchTask}
          />
        </div>
      </div>

      {/* Detail Grid */}
      <div className="td-grid">
        {/* Left Column - Main */}
        <div className="td-main">
          {/* Description */}
          {task.description && (
            <section className="td-section">
              <h2>Description</h2>
              <p className="td-description">{task.description}</p>
            </section>
          )}

          {/* Work Order Info */}
          <section className="td-section">
            <h2>Work Order</h2>
            <div className="td-info-grid">
              <div className="td-info-item">
                <label>Work Order</label>
                <Link
                  href={`/work-orders/${task.workOrder.id}`}
                  className="td-info-link"
                >
                  {task.workOrder.workOrderNumber} - {task.workOrder.title}
                </Link>
              </div>
              <div className="td-info-item">
                <label>Work Package</label>
                <span>
                  {task.workPackage.name} (
                  {task.workPackage.packageType.replace(/_/g, " ")})
                </span>
              </div>
              {task.workOrder.customer && (
                <div className="td-info-item">
                  <label>Customer</label>
                  <Link
                    href={`/customers/${task.workOrder.customer.id}`}
                    className="td-info-link"
                  >
                    {task.workOrder.customer.name}
                  </Link>
                </div>
              )}
              {task.workOrder.site && (
                <div className="td-info-item">
                  <label>Site</label>
                  <span>{task.workOrder.site.name}</span>
                </div>
              )}
            </div>
          </section>

          {/* Dependencies */}
          {hasDependencies && (
            <section className="td-section">
              <h2>Dependencies</h2>
              {task.blockedBy && (
                <div className="td-dep-alert">
                  <span className="td-dep-alert-icon">🚫</span>
                  <div>
                    <strong>Blocked by: </strong>
                    <Link
                      href={`/tasks/${task.blockedBy.id}`}
                      className="td-dep-link"
                    >
                      {task.blockedBy.title} ({task.blockedBy.status.replace(/_/g, " ")})
                    </Link>
                  </div>
                </div>
              )}
              {task.blockingTasks.length > 0 && (
                <div className="td-blocking-section">
                  <strong>This task is blocking:</strong>
                  <ul className="td-blocking-list">
                    {task.blockingTasks.map((bt) => (
                      <li key={bt.id}>
                        <Link href={`/tasks/${bt.id}`} className="td-dep-link">
                          {bt.title} ({bt.status.replace(/_/g, " ")})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Evidence */}
          <section className="td-section">
            <h2>
              Evidence & Notes
              {task.requiresEvidence && (
                <span className="td-required-badge">Required</span>
              )}
            </h2>
            <EvidenceCapture taskId={task.id} onEvidenceAdded={fetchTask} />
          </section>

          {/* Measurements */}
          <section className="td-section">
            <h2>Measurements</h2>
            <MeasurementEntry
              taskId={task.id}
              measurements={task.measurements}
              onRefresh={fetchTask}
            />
          </section>

          {/* Materials */}
          {task.materialUsages.length > 0 && (
            <section className="td-section">
              <h2>Materials Used</h2>
              <div className="td-materials-list">
                {task.materialUsages.map((mat) => (
                  <div key={mat.id} className="td-material-item">
                    <div className="td-mat-info">
                      <span className="td-mat-name">{mat.name}</span>
                      {mat.partNumber && (
                        <span className="td-mat-part">P/N: {mat.partNumber}</span>
                      )}
                    </div>
                    <div className="td-mat-right">
                      <span className="td-mat-qty">
                        {mat.quantity} {mat.unit || "ea"}
                        {mat.unitCost != null && (
                          <> @ ${Number(mat.unitCost).toFixed(2)}</>
                        )}
                      </span>
                      {mat.totalCost != null && (
                        <span className="td-mat-total">
                          ${Number(mat.totalCost).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="td-sidebar">
          {/* Assignment */}
          <div className="td-sidebar-card">
            <h3>Assignment</h3>
            {task.assignedTo ? (
              <div className="td-assigned-user">
                <span className="td-user-avatar">👤</span>
                <div>
                  <span className="td-user-name">
                    {task.assignedTo.name || task.assignedTo.email}
                  </span>
                  <span className="td-user-email">{task.assignedTo.email}</span>
                </div>
              </div>
            ) : (
              <p className="td-unassigned">Not assigned</p>
            )}
          </div>

          {/* Time Tracking */}
          <div className="td-sidebar-card">
            <h3>Time Spent</h3>
            {totalTimeSeconds > 0 ? (
              <div>
                <span className="td-time-value">
                  {formatDuration(totalTimeSeconds)}
                </span>
                {task.timeEntries.length > 0 && (
                  <div className="td-time-entries-mini">
                    {task.timeEntries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="td-time-entry-mini">
                        <span>{entry.user.name || "Tech"}</span>
                        <span>{formatDuration(entry.accumulatedSeconds || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="td-no-time">No time logged</p>
            )}
          </div>

          {/* Task Stats */}
          <div className="td-sidebar-card">
            <h3>Stats</h3>
            <div className="td-stats-list">
              <div className="td-stat-item">
                <span className="td-stat-icon">📷</span>
                <span className="td-stat-label">Evidence</span>
                <span className="td-stat-value">{task.evidence.length}</span>
              </div>
              <div className="td-stat-item">
                <span className="td-stat-icon">📊</span>
                <span className="td-stat-label">Measurements</span>
                <span className="td-stat-value">{task.measurements.length}</span>
              </div>
              <div className="td-stat-item">
                <span className="td-stat-icon">🔧</span>
                <span className="td-stat-label">Materials</span>
                <span className="td-stat-value">{task.materialUsages.length}</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="td-sidebar-card">
            <h3>Dates</h3>
            <div className="td-dates-list">
              <div className="td-date-item">
                <label>Created</label>
                <span>{new Date(task.createdAt).toLocaleString()}</span>
              </div>
              <div className="td-date-item">
                <label>Last Updated</label>
                <span>{new Date(task.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
