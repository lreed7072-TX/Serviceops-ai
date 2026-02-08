"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { WorkOrderStatus, ExecutionMode, OrderType } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import TaskList from "@/components/tasks/TaskList";
import "./work-order-detail.css";

interface TaskMeasurement {
  id: string;
  name: string;
  measurementType: string;
  numericValue: number | null;
  textValue: string | null;
  passFail: boolean | null;
  unit: string | null;
  isWithinSpec: boolean | null;
  capturedAt: string | null;
}

interface TaskMaterialUsage {
  id: string;
  name: string;
  partNumber: string | null;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
}

interface TaskInstance {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "SKIPPED";
  sequenceNumber: number | null;
  isCritical: boolean;
  requiresEvidence: boolean;
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  measurements: TaskMeasurement[];
  materialUsages: TaskMaterialUsage[];
  timeEntries: Array<{
    id: string;
    status: string;
    accumulatedSeconds: number;
  }>;
}

interface WorkPackage {
  id: string;
  name: string;
  packageType: string;
  status: string;
  leadTech: { id: string; name: string | null; email: string } | null;
  tasks: TaskInstance[];
}

interface Visit {
  id: string;
  assignedTechId: string | null;
  assignedTech: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  status: string;
}

interface WorkOrder {
  id: string;
  workOrderNumber: string | null;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  executionMode: ExecutionMode;
  orderType: OrderType;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    primaryEmail: string | null;
  } | null;
  site: {
    id: string;
    name: string;
  } | null;
  asset: {
    id: string;
    assetNumber: string;
    description: string | null;
  } | null;
  quote: {
    id: string;
    quoteNumber: string;
  } | null;
  packages?: WorkPackage[];
  visits?: Visit[];
  summary?: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
  };
  timeEntries?: Array<{
    id: string;
    accumulatedSeconds: number;
    status: string;
  }>;
}

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface ActiveTimer {
  id: string;
  status: "RUNNING" | "PAUSED";
  workOrderId: string;
  accumulatedSeconds: number;
  currentSeconds: number;
  startedAt: string;
}

interface TimeEntryRecord {
  id: string;
  status: string;
  accumulatedSeconds: number;
  startedAt: string;
  stoppedAt: string | null;
  user: { name: string | null; email: string };
}

export default function WorkOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Tech assignment state
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [assignTasks, setAssignTasks] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);

  // Time tracking state
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timeEntries, setTimeEntries] = useState<TimeEntryRecord[]>([]);
  const [timerLoading, setTimerLoading] = useState(false);

  const workOrderId = params?.id;

  useEffect(() => {
    if (workOrderId) {
      fetchWorkOrder();
      fetchUsers();
      fetchTimer();
      fetchTimeEntries();
    }
  }, [workOrderId]);

  // Clear email status after 5 seconds
  useEffect(() => {
    if (emailStatus) {
      const timer = setTimeout(() => setEmailStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [emailStatus]);

  // Timer tick - update display every second when running
  useEffect(() => {
    if (activeTimer?.status === "RUNNING") {
      setTimerSeconds(activeTimer.currentSeconds);
      const interval = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (activeTimer?.status === "PAUSED") {
      setTimerSeconds(activeTimer.currentSeconds);
    } else {
      setTimerSeconds(0);
    }
  }, [activeTimer]);

  const fetchWorkOrder = async () => {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/api/work-orders/${workOrderId}`);
      if (response.ok) {
        const result = await response.json();
        setWorkOrder(result.data);
      } else {
        console.error("Failed to fetch work order");
      }
    } catch (error) {
      console.error("Error fetching work order:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiFetch("/api/users");
      if (response.ok) {
        const result = await response.json();
        setOrgUsers(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchTimer = async () => {
    try {
      const response = await apiFetch("/api/tech/timer");
      if (response.ok) {
        const result = await response.json();
        // Only show timer if it's for this work order
        if (result.data && result.data.workOrderId === workOrderId) {
          setActiveTimer(result.data);
        } else {
          setActiveTimer(null);
        }
      }
    } catch (error) {
      console.error("Error fetching timer:", error);
    }
  };

  const fetchTimeEntries = async () => {
    if (!workOrderId) return;
    try {
      const response = await apiFetch(`/api/work-orders/${workOrderId}`);
      if (response.ok) {
        const result = await response.json();
        // Extract time entries with user info from the full WO response
        const entries = result.data?.timeEntries || [];
        setTimeEntries(entries);
      }
    } catch (error) {
      console.error("Error fetching time entries:", error);
    }
  };

  const handleStartTimer = async () => {
    if (!workOrderId) return;
    setTimerLoading(true);
    try {
      const response = await apiFetch("/api/tech/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId }),
      });
      if (response.ok) {
        await fetchTimer();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to start timer");
      }
    } catch (error) {
      console.error("Failed to start timer:", error);
    } finally {
      setTimerLoading(false);
    }
  };

  const handlePauseTimer = async () => {
    setTimerLoading(true);
    try {
      const response = await apiFetch("/api/tech/timer/pause", { method: "POST" });
      if (response.ok) {
        await fetchTimer();
      }
    } catch (error) {
      console.error("Failed to pause timer:", error);
    } finally {
      setTimerLoading(false);
    }
  };

  const handleResumeTimer = async () => {
    setTimerLoading(true);
    try {
      const response = await apiFetch("/api/tech/timer/resume", { method: "POST" });
      if (response.ok) {
        await fetchTimer();
      }
    } catch (error) {
      console.error("Failed to resume timer:", error);
    } finally {
      setTimerLoading(false);
    }
  };

  const handleStopTimer = async () => {
    if (!confirm("Stop the timer?")) return;
    setTimerLoading(true);
    try {
      const response = await apiFetch("/api/tech/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        setActiveTimer(null);
        setTimerSeconds(0);
        await fetchTimeEntries();
        await fetchWorkOrder();
      }
    } catch (error) {
      console.error("Failed to stop timer:", error);
    } finally {
      setTimerLoading(false);
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    }
    return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  };

  const formatHours = (totalSeconds: number) => {
    return (totalSeconds / 3600).toFixed(1) + "h";
  };

  const handleStatusChange = async (newStatus: WorkOrderStatus) => {
    if (!workOrder) return;

    if (!confirm(`Change work order status to ${newStatus}?`)) return;

    try {
      const response = await apiFetch(`/api/work-orders/${workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchWorkOrder();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("An error occurred while updating status");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!workOrder) return;

    setDownloadingPdf(true);
    try {
      const response = await apiFetch(`/api/work-orders/${workOrder.id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${workOrder.workOrderNumber || `WO-${workOrder.id.slice(0, 8)}`}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download PDF:", error);
      alert("Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleEmailWorkOrder = async () => {
    if (!workOrder) return;

    if (!workOrder.customer?.primaryEmail) {
      setEmailStatus({ type: "error", message: "Customer does not have an email address." });
      return;
    }

    if (!confirm(`Send work order to ${workOrder.customer.primaryEmail}?`)) return;

    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const response = await apiFetch(`/api/work-orders/${workOrder.id}/email`, {
        method: "POST",
      });

      const result = await response.json();
      if (response.ok) {
        setEmailStatus({ type: "success", message: result.message || "Email sent successfully!" });
      } else {
        setEmailStatus({ type: "error", message: result.error || "Failed to send email" });
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      setEmailStatus({ type: "error", message: "An error occurred while sending email" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAssignTech = async () => {
    if (!workOrder || !selectedTechId) return;

    setAssigning(true);
    try {
      const response = await apiFetch(`/api/work-orders/${workOrder.id}/assign-tech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techId: selectedTechId, assignTasks }),
      });

      if (response.ok) {
        setSelectedTechId("");
        await fetchWorkOrder();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to assign technician");
      }
    } catch (error) {
      console.error("Failed to assign tech:", error);
      alert("An error occurred while assigning technician");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignTech = async (techId: string) => {
    if (!workOrder) return;

    if (!confirm("Remove this technician from the work order?")) return;

    setUnassigning(techId);
    try {
      const response = await apiFetch(`/api/work-orders/${workOrder.id}/unassign-tech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techId }),
      });

      if (response.ok) {
        await fetchWorkOrder();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to remove technician");
      }
    } catch (error) {
      console.error("Failed to unassign tech:", error);
      alert("An error occurred while removing technician");
    } finally {
      setUnassigning(null);
    }
  };

  const handleDeleteWorkOrder = async () => {
    if (!workOrder) return;

    setDeleting(true);
    try {
      const response = await apiFetch(`/api/work-orders/${workOrder.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/work-orders");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete work order");
      }
    } catch (error) {
      console.error("Failed to delete work order:", error);
      alert("An error occurred while deleting");
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  // Get techs currently assigned to this WO (from visits)
  const getAssignedTechs = (): Array<{ id: string; name: string; email: string }> => {
    if (!workOrder?.visits) return [];
    const seen = new Set<string>();
    const techs: Array<{ id: string; name: string; email: string }> = [];
    for (const visit of workOrder.visits) {
      if (visit.assignedTech && !seen.has(visit.assignedTech.id)) {
        seen.add(visit.assignedTech.id);
        techs.push({
          id: visit.assignedTech.id,
          name: visit.assignedTech.name || visit.assignedTech.email,
          email: visit.assignedTech.email,
        });
      }
    }
    return techs;
  };

  // Available techs = org users with TECH role minus already assigned
  const getAvailableTechs = () => {
    const assignedIds = new Set(getAssignedTechs().map((t) => t.id));
    return orgUsers.filter((u) => u.role === "TECH" && !assignedIds.has(u.id));
  };

  const getStatusClass = (status: WorkOrderStatus) => {
    return status.toLowerCase().replace("_", "-");
  };

  const getOrderTypeDisplay = (type: OrderType) => {
    switch (type) {
      case OrderType.WORK_ORDER:
        return "Work Order";
      case OrderType.SALES_ORDER:
        return "Sales Order";
      case OrderType.PROJECT:
        return "Project";
      default:
        return type;
    }
  };

  const getOrderTypeClass = (type: OrderType) => {
    return type.toLowerCase().replace("_", "-");
  };

  const getExecutionModeDisplay = (mode: ExecutionMode) => {
    return mode === ExecutionMode.UNIFIED ? "Unified" : "Multi-Lane";
  };

  const getExecutionModeClass = (mode: ExecutionMode) => {
    return mode.toLowerCase().replace("_", "-");
  };

  const isEditable = workOrder?.status !== WorkOrderStatus.COMPLETED && workOrder?.status !== WorkOrderStatus.CANCELED;

  if (loading) {
    return (
      <div className="wo-detail-container">
        <div className="loading-state">
          <div className="loading-spinner-large"></div>
          <div className="loading-text">Loading work order...</div>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="wo-detail-container">
        <div className="loading-state">
          <div className="loading-text">Work order not found</div>
        </div>
      </div>
    );
  }

  const assignedTechs = getAssignedTechs();
  const availableTechs = getAvailableTechs();

  return (
    <div className="wo-detail-container">
      {/* Header */}
      <div className="wo-detail-header">
        <button
          onClick={() => router.push("/work-orders")}
          className="back-link"
        >
          ← Back to Work Orders
        </button>

        <div className="wo-header-content">
          <div className="wo-header-left">
            <div className="wo-number-badge">
              {workOrder.workOrderNumber || `WO-${workOrder.id.slice(0, 8)}`}
            </div>
            <div className="wo-title">{workOrder.title}</div>

            <div className="wo-badges-row">
              <span className={`wo-type-badge ${getOrderTypeClass(workOrder.orderType)}`}>
                {getOrderTypeDisplay(workOrder.orderType)}
              </span>
              <span className={`wo-exec-mode-badge ${getExecutionModeClass(workOrder.executionMode)}`}>
                {getExecutionModeDisplay(workOrder.executionMode)}
              </span>
            </div>

            <div className="wo-metadata">
              <div className="wo-meta-item">
                <span className="wo-meta-icon">📅</span>
                <span>Created <span className="wo-meta-value">{new Date(workOrder.createdAt).toLocaleDateString()}</span></span>
              </div>
              {workOrder.quote && (
                <div className="wo-meta-item">
                  <span className="wo-meta-icon">📋</span>
                  <span>From Quote <span className="wo-meta-value">{workOrder.quote.quoteNumber}</span></span>
                </div>
              )}
            </div>
          </div>

          <div className={`wo-status-badge-large ${getStatusClass(workOrder.status)}`}>
            {workOrder.status.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Email Status Banner */}
      {emailStatus && (
        <div className={`email-status-banner ${emailStatus.type}`}>
          <span>{emailStatus.type === "success" ? "✓" : "!"}</span>
          {emailStatus.message}
        </div>
      )}

      {/* Customer & Site Information */}
      <div className="wo-section">
        <h2 className="wo-section-title">
          <span className="section-icon">🏢</span>
          Location Information
        </h2>
        <div className="customer-grid">
          <div className="info-block">
            <div className="info-label">Customer</div>
            <div className="info-value">{workOrder.customer?.name || "No customer assigned"}</div>
          </div>

          <div className="info-block">
            <div className="info-label">Site</div>
            <div className="info-value">{workOrder.site?.name || "No site assigned"}</div>
          </div>

          {workOrder.asset && (
            <div className="info-block">
              <div className="info-label">Asset</div>
              <div className="info-value">
                {workOrder.asset.assetNumber}
                {workOrder.asset.description && (
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                    {workOrder.asset.description}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team Assignment */}
      <div className="wo-section">
        <h2 className="wo-section-title">
          <span className="section-icon">👥</span>
          Team Assignment
        </h2>
        <div className="team-assignment-section">
          {/* Currently Assigned Techs */}
          {assignedTechs.length > 0 ? (
            <div className="assigned-techs-list">
              {assignedTechs.map((tech) => (
                <div key={tech.id} className="tech-chip">
                  <span className="tech-chip-icon">👤</span>
                  <span className="tech-chip-name">{tech.name}</span>
                  {isEditable && (
                    <button
                      className="tech-chip-remove"
                      onClick={() => handleUnassignTech(tech.id)}
                      disabled={unassigning === tech.id}
                      title="Remove technician"
                    >
                      {unassigning === tech.id ? "..." : "✕"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-techs-message">No technicians assigned yet</div>
          )}

          {/* Assign New Tech */}
          {isEditable && availableTechs.length > 0 && (
            <div className="assign-tech-form">
              <select
                className="assign-tech-dropdown"
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
              >
                <option value="">Select a technician...</option>
                {availableTechs.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>

              <label className="assign-tasks-checkbox">
                <input
                  type="checkbox"
                  checked={assignTasks}
                  onChange={(e) => setAssignTasks(e.target.checked)}
                />
                <span>Assign unassigned tasks</span>
              </label>

              <button
                className="assign-tech-btn"
                onClick={handleAssignTech}
                disabled={!selectedTechId || assigning}
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          )}

          {isEditable && availableTechs.length === 0 && orgUsers.filter((u) => u.role === "TECH").length === 0 && (
            <div className="no-techs-message" style={{ marginTop: 8 }}>
              No technicians found in your organization.
            </div>
          )}
        </div>
      </div>

      {/* Time Tracking */}
      {(workOrder.status === WorkOrderStatus.IN_PROGRESS || workOrder.status === WorkOrderStatus.OPEN) && (
        <div className="wo-section">
          <h2 className="wo-section-title">
            <span className="section-icon">⏱️</span>
            Time Tracking
          </h2>
          <div className="time-tracking-section">
            {activeTimer ? (
              <div className="timer-active-display">
                <div className="timer-clock">
                  <span className={`timer-value ${activeTimer.status === "RUNNING" ? "running" : "paused"}`}>
                    {formatDuration(timerSeconds)}
                  </span>
                  <span className={`timer-status-label ${activeTimer.status.toLowerCase()}`}>
                    {activeTimer.status}
                  </span>
                </div>
                <div className="timer-controls">
                  {activeTimer.status === "RUNNING" ? (
                    <>
                      <button
                        onClick={handlePauseTimer}
                        disabled={timerLoading}
                        className="timer-btn pause"
                      >
                        ⏸ Pause
                      </button>
                      <button
                        onClick={handleStopTimer}
                        disabled={timerLoading}
                        className="timer-btn stop"
                      >
                        ⏹ Stop
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleResumeTimer}
                        disabled={timerLoading}
                        className="timer-btn resume"
                      >
                        ▶ Resume
                      </button>
                      <button
                        onClick={handleStopTimer}
                        disabled={timerLoading}
                        className="timer-btn stop"
                      >
                        ⏹ Stop
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartTimer}
                disabled={timerLoading}
                className="timer-btn start"
              >
                {timerLoading ? "Starting..." : "▶ Start Work Timer"}
              </button>
            )}

            {/* Time Entry Summary from WO data */}
            {workOrder.timeEntries && workOrder.timeEntries.length > 0 && (
              <div className="time-entries-summary">
                <h4 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Time Entries ({workOrder.timeEntries.length})
                </h4>
                <div className="time-entry-total">
                  Total logged: {formatHours(
                    workOrder.timeEntries.reduce(
                      (sum: number, e: any) => sum + (e.accumulatedSeconds || 0),
                      0
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {workOrder.description && (
        <div className="wo-section">
          <h2 className="wo-section-title">
            <span className="section-icon">📝</span>
            Description
          </h2>
          <div className="wo-description-block">
            <div className="wo-description-text">{workOrder.description}</div>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="wo-section">
        <h2 className="wo-section-title">
          <span className="section-icon">✓</span>
          Tasks
          {workOrder.summary && workOrder.summary.totalTasks > 0 && (
            <span style={{ fontWeight: 400, fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.5rem' }}>
              ({workOrder.summary.completedTasks}/{workOrder.summary.totalTasks} complete)
            </span>
          )}
        </h2>
        <TaskList
          packages={workOrder.packages ?? []}
          workOrderId={workOrder.id}
          onRefresh={fetchWorkOrder}
        />
      </div>

      {/* Actions */}
      <div className="actions-section no-print">
        <h3 className="actions-title">
          <span className="section-icon">⚡</span>
          Actions
        </h3>
        <div className="actions-grid">
          {/* Edit Button - always available except for completed/canceled */}
          {isEditable && (
            <button
              onClick={() => router.push(`/work-orders/${workOrder.id}/edit`)}
              className="action-button primary"
            >
              <span>✏️</span> Edit Work Order
            </button>
          )}

          {/* Status Change Actions */}
          {workOrder.status === WorkOrderStatus.OPEN && (
            <button
              onClick={() => handleStatusChange(WorkOrderStatus.IN_PROGRESS)}
              className="action-button success"
            >
              <span>▶️</span> Start Work Order
            </button>
          )}

          {workOrder.status === WorkOrderStatus.IN_PROGRESS && (
            <button
              onClick={() => handleStatusChange(WorkOrderStatus.COMPLETED)}
              className="action-button success"
            >
              <span>✓</span> Mark Complete
            </button>
          )}

          {/* Generate Invoice - for completed work orders */}
          {workOrder.status === WorkOrderStatus.COMPLETED && (
            <button
              onClick={() => router.push(`/invoices/new?workOrderId=${workOrder.id}`)}
              className="action-button primary"
            >
              <span>📄</span> Generate Invoice
            </button>
          )}

          {/* Email to Customer */}
          <button
            onClick={handleEmailWorkOrder}
            disabled={sendingEmail}
            className="action-button email"
          >
            <span>{sendingEmail ? "⏳" : "📧"}</span>
            {sendingEmail ? "Sending..." : "Email to Customer"}
          </button>

          {/* Export Actions */}
          <button
            onClick={handlePrint}
            className="action-button secondary"
          >
            <span>🖨️</span> Print
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="action-button secondary"
          >
            <span>{downloadingPdf ? "⏳" : "📑"}</span>
            {downloadingPdf ? "Generating..." : "Download PDF"}
          </button>

          {/* Cancel - danger action */}
          {workOrder.status !== WorkOrderStatus.CANCELED && workOrder.status !== WorkOrderStatus.COMPLETED && (
            <button
              onClick={() => handleStatusChange(WorkOrderStatus.CANCELED)}
              className="action-button danger"
            >
              <span>✗</span> Cancel Work Order
            </button>
          )}

          {/* Delete - only for OPEN or CANCELED */}
          {(workOrder.status === WorkOrderStatus.OPEN || workOrder.status === WorkOrderStatus.CANCELED) && (
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="action-button danger"
            >
              <span>🗑️</span> Delete Work Order
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="delete-modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="delete-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h3>Delete Work Order</h3>
              <button
                onClick={() => !deleting && setDeleteModalOpen(false)}
                className="delete-modal-close"
                disabled={deleting}
              >
                ✕
              </button>
            </div>
            <div className="delete-modal-body">
              <div className="delete-warning-icon">⚠️</div>
              <p>Are you sure you want to delete work order <strong>{workOrder.workOrderNumber || `WO-${workOrder.id.slice(0, 8).toUpperCase()}`}</strong>?</p>
              <p className="delete-wo-title">"{workOrder.title}"</p>
              <p className="delete-warning-text">This action cannot be undone. All associated tasks, time entries, and data will be permanently removed.</p>
            </div>
            <div className="delete-modal-footer">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="btn-modal-cancel"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkOrder}
                className="btn-modal-delete"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Work Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
