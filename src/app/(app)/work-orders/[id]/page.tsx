"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { TaskStatus } from "@prisma/client";
import type { TaskInstance, WorkOrder, WorkPackage, User } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { AITaskReviewModal } from "@/components/AITaskReviewModal";

type TaskWithPackage = TaskInstance & { 
  workPackage: WorkPackage;
  assignedTo?: { id: string; name: string | null; email: string } | null;
  blockedBy?: { id: string; title: string; status: string } | null;
};
type MaterialUsage = { id: string; name: string; partNumber: string | null; quantity: number; unitCost: number | null; unit: string | null; totalCost: number | null; taskInstanceId: string; };
type SignatureData = { id: string; signatureType: "CUSTOMER" | "TECH" | "WITNESS"; signerName: string; signerTitle: string | null; signatureData: string; signedAt: string; };

type TaskFormState = { title: string; description: string; assignedToId: string; isCritical: boolean; };

const executionModeLabels: Record<string, string> = { UNIFIED: "Unified", MULTI_LANE: "Multi-lane" };
const taskStatusLabels: Record<TaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done", BLOCKED: "Blocked", SKIPPED: "Skipped" };
const defaultTaskFormState: TaskFormState = { title: "", description: "", assignedToId: "", isCritical: false };

export default function WorkOrderDetailPage() {
  const params = useParams();
  const workOrderId = params?.id as string | undefined;
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [packages, setPackages] = useState<WorkPackage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskWithPackage[]>([]);
  const [materials, setMaterials] = useState<MaterialUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>(defaultTaskFormState);
  const [taskFormLoading, setTaskFormLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [taskMaterials, setTaskMaterials] = useState<MaterialUsage[]>([]);
  const [signatures, setSignatures] = useState<SignatureData[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiModalData, setAiModalData] = useState<any>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<{ assignedToId: string }>({ assignedToId: "" });

  useEffect(() => {
    if (!workOrderId) return;
    const load = async () => {
      try {
        setLoading(true);
        const [woRes, pkgRes, taskRes, userRes] = await Promise.all([
          apiFetch(`/api/work-orders/${workOrderId}`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/packages`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" }),
          apiFetch(`/api/users`, { cache: "no-store" }),
        ]);
        if (!woRes.ok) throw new Error("Failed to load work order");
        setWorkOrder((await woRes.json()).data);
        setPackages(pkgRes.ok ? (await pkgRes.json()).data ?? [] : []);
        setTasks(taskRes.ok ? (await taskRes.json()).data ?? [] : []);
        setUsers(userRes.ok ? (await userRes.json()).data ?? [] : []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workOrderId]);

  // Load materials for all tasks
  useEffect(() => {
    if (tasks.length === 0) return;
    const loadMaterials = async () => {
      const allMats: MaterialUsage[] = [];
      for (const task of tasks) {
        try {
          const res = await apiFetch(`/api/tasks/${task.id}/materials`, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()).data ?? [];
            data.forEach((m: any) => allMats.push({ ...m, taskInstanceId: task.id }));
          }
        } catch (e) { /* ignore */ }
      }
      setMaterials(allMats);
    };
    loadMaterials();
  }, [tasks]);

  // Load signatures
  useEffect(() => {
    if (!workOrderId) return;
    const loadSignatures = async () => {
      try {
        const res = await apiFetch(`/api/work-orders/${workOrderId}/signatures`, { cache: "no-store" });
        if (res.ok) setSignatures((await res.json()).data ?? []);
      } catch (e) { /* ignore */ }
    };
    loadSignatures();
  }, [workOrderId]);

  const userLookup = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const groupedTasks = useMemo(() => {
    const map: Record<string, TaskWithPackage[]> = {};
    tasks.forEach((task) => {
      if (!map[task.workPackageId]) map[task.workPackageId] = [];
      map[task.workPackageId].push(task);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0)));
    return map;
  }, [tasks]);

  const refreshTasks = async () => {
    if (!workOrderId) return;
    const res = await apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" });
    if (res.ok) setTasks((await res.json()).data ?? []);
  };

  const handleAddTask = async (packageId: string, e: FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setTaskFormLoading(true);
    try {
      const res = await apiFetch(`/api/work-packages/${packageId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          assignedToId: taskForm.assignedToId || null,
          isCritical: taskForm.isCritical,
        }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      setTaskForm(defaultTaskFormState);
      setShowAddTask(null);
      await refreshTasks();
    } catch (e: any) {
      setTaskError(e?.message);
    } finally {
      setTaskFormLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      await refreshTasks();
    } catch (e: any) {
      setTaskError(e?.message);
    }
  };

  const loadTaskDetails = async (taskId: string) => {
    setSelectedTask(taskId);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/materials`, { cache: "no-store" });
      if (res.ok) setTaskMaterials((await res.json()).data ?? []);
      else setTaskMaterials([]);
    } catch (e) {
      setTaskMaterials([]);
    }
  };

  const handleGenerateAITasks = async () => {
    if (!workOrderId) return;
    
    setAiGenerating(true);
    setAiError(null);
    setAiSuccess(null);
    
    try {
      const res = await apiFetch(`/api/work-orders/${workOrderId}/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate AI tasks");
      }
      
      const data = await res.json();
      
      // Show modal with AI-generated tasks
      setAiModalData(data.data);
      setShowAIModal(true);
      
    } catch (e: any) {
      setAiError(e?.message ?? "Failed to generate AI tasks");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAITasksApproved = () => {
    setShowAIModal(false);
    setAiSuccess("Tasks created successfully!");
    setTimeout(() => {
      setAiSuccess(null);
      refreshTasks();
    }, 2000);
  };

  const handleEditTask = (task: TaskWithPackage) => {
    setEditingTask(task.id);
    setEditTaskForm({ assignedToId: task.assignedToId || "" });
  };

  const handleSaveTaskEdit = async (taskId: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: editTaskForm.assignedToId || null }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      setEditingTask(null);
      await refreshTasks();
    } catch (e: any) {
      setTaskError(e?.message);
    }
  };

  const totalMaterialsCost = materials.reduce((sum, m) => sum + (m.totalCost ?? 0), 0);

  if (!workOrderId) return <div className="card"><p>Missing work order ID.</p></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link href="/work-orders" className="back-link">← Work Orders</Link>
          <h1>{workOrder?.title ?? "Work Order"}</h1>
        </div>
        {workOrder && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => window.open(`/api/work-orders/${workOrderId}/report`, '_blank')}
              className="btn btn-outline"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              📄 Download Report
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="alert alert-info">Loading...</div>}

      {workOrder && (
        <>
          <div className="card">
            <p>{workOrder.description ?? "No description"}</p>
            <div className="wo-meta-grid">
              <div><span className="label">WO #</span><span className="value">{(workOrder as any).workOrderNumber ?? "—"}</span></div>
              <div><span className="label">Status</span><span className="value">{workOrder.status}</span></div>
              <div><span className="label">Mode</span><span className="value">{executionModeLabels[workOrder.executionMode]}</span></div>
              <div><span className="label">Updated</span><span className="value">{new Date(workOrder.updatedAt).toLocaleString()}</span></div>
            </div>
            
            {/* AI Task Generation */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  onClick={handleGenerateAITasks}
                  disabled={aiGenerating || loading}
                  className="btn-primary"
                  style={{ 
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  {aiGenerating ? "🤖 Generating..." : "✨ Generate AI Tasks"}
                </button>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Let Claude AI create a standards-driven task list
                </span>
              </div>
            {aiError && <div className="alert alert-error" style={{ marginTop: 12 }}>{aiError}</div>}
            {aiSuccess && <div className="alert alert-success" style={{ marginTop: 12 }}>{aiSuccess}</div>}
          </div>
        </div>
        </>
      )}

      {/* Quick Stats Summary */}
      {workOrder && tasks.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Total Tasks</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{tasks.length}</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Completed</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>
              {tasks.filter(t => t.status === "DONE").length}
            </div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Completion Rate</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>
              {Math.round((tasks.filter(t => t.status === "DONE").length / tasks.length) * 100)}%
            </div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Materials Cost</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
              ${materials.reduce((sum, m) => sum + (m.totalCost || 0), 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      <AttachmentsPanel entityType="workOrder" entityId={workOrderId} />

      {/* Materials Summary */}
      {materials.length > 0 && (
        <div className="card">
          <h2>Materials Used</h2>
          <div className="materials-summary">
            {materials.map((m) => {
              const task = tasks.find((t) => t.id === m.taskInstanceId);
              return (
                <div key={m.id} className="material-summary-item">
                  <div>
                    <strong>{m.name}</strong>
                    {m.partNumber && <span className="muted"> #{m.partNumber}</span>}
                  </div>
                  <div className="material-summary-details">
                    <span>{m.quantity} {m.unit || "ea"}</span>
                    {m.totalCost && <span className="material-cost">${m.totalCost.toFixed(2)}</span>}
                    <span className="muted">({task?.title ?? "Unknown task"})</span>
                  </div>
                </div>
              );
            })}
            <div className="materials-total">
              <strong>Total: ${totalMaterialsCost.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Packages & Tasks */}
      <div className="card">
        <h2>Packages & Tasks</h2>
        {taskError && <div className="alert alert-error">{taskError}</div>}

        {packages.length === 0 ? (
          <p className="muted">No packages yet.</p>
        ) : (
          packages.map((pkg) => {
            const pkgTasks = groupedTasks[pkg.id] ?? [];
            const completedCount = pkgTasks.filter(t => t.status === "DONE").length;
            const totalCount = pkgTasks.length;
            const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            
            return (
              <div key={pkg.id} className="package-section">
                <div className="package-header">
                  <div>
                    <h3>{pkg.name}</h3>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      <span className="badge">{pkg.packageType}</span>
                      <span className="badge" style={{ 
                        background: completionPercent === 100 ? "#10b981" : completionPercent > 0 ? "#f59e0b" : "#6b7280",
                        color: "white"
                      }}>
                        {completedCount}/{totalCount} Complete ({completionPercent}%)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{
                      marginTop: 8,
                      height: 6,
                      background: "#e5e7eb",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${completionPercent}%`,
                        background: completionPercent === 100 ? "#10b981" : "#f59e0b",
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                  </div>
                  <div className="package-meta">
                    <span>Status: {pkg.status}</span>
                  </div>
                </div>

                {/* Task List */}
                <div className="task-list-admin">
                  {pkgTasks.length === 0 ? (
                    <p className="muted">No tasks in this package.</p>
                  ) : (
                    pkgTasks.map((task) => {
                      const user = task.assignedToId ? userLookup.get(task.assignedToId) : null;
                      const isSelected = selectedTask === task.id;
                      const isEditing = editingTask === task.id;
                      const taskMats = materials.filter((m) => m.taskInstanceId === task.id);
                      
                      return (
                        <div key={task.id} className={`task-card ${isSelected ? "selected" : ""}`}>
                          <div className="task-card-main" onClick={() => loadTaskDetails(task.id)}>
                            <div className="task-card-info">
                              <strong>{task.title}</strong>
                              {task.isCritical && <span className="badge critical">Critical</span>}
                              {task.blockedBy && task.blockedBy.status !== "DONE" && (
                                <span className="badge" style={{ background: "#ef4444", color: "white" }}>
                                  🔒 Blocked by: {task.blockedBy.title}
                                </span>
                              )}
                              {task.description && <p className="task-desc">{task.description}</p>}
                            </div>
                            <div className="task-card-meta">
                              <span className={`task-status status-${task.status.toLowerCase()}`}>
                                {taskStatusLabels[task.status]}
                              </span>
                              {!isEditing && (
                                <span className="muted">{user?.name || user?.email || "Unassigned"}</span>
                              )}
                              {isEditing && (
                                <select
                                  value={editTaskForm.assignedToId}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setEditTaskForm({ assignedToId: e.target.value });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ padding: "4px 8px", fontSize: 13 }}
                                >
                                  <option value="">Unassigned</option>
                                  {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name || u.email}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                          
                          {isSelected && (
                            <div className="task-card-details">
                              <div className="task-detail-section">
                                <h4>Materials ({taskMats.length})</h4>
                                {taskMats.length === 0 ? (
                                  <p className="muted">No materials recorded.</p>
                                ) : (
                                  <ul className="task-materials-list">
                                    {taskMats.map((m) => (
                                      <li key={m.id}>
                                        {m.name} × {m.quantity} {m.unit || "ea"}
                                        {m.totalCost && <span> — ${m.totalCost.toFixed(2)}</span>}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div className="task-card-actions">
                                {!isEditing ? (
                                  <>
                                    <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}>Edit Assignment</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id)}>Delete</button>
                                  </>
                                ) : (
                                  <>
                                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleSaveTaskEdit(task.id); }}>Save</button>
                                    <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setEditingTask(null); }}>Cancel</button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Task Button/Form */}
                {showAddTask === pkg.id ? (
                  <form className="add-task-form" onSubmit={(e) => handleAddTask(pkg.id, e)}>
                    <h4>Add New Task</h4>
                    <div className="form-field">
                      <label>Title *</label>
                      <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" required />
                    </div>
                    <div className="form-field">
                      <label>Description</label>
                      <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Optional details" rows={2} />
                    </div>
                    <div className="form-field">
                      <label>Assign To</label>
                      <select value={taskForm.assignedToId} onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}>
                        <option value="">Unassigned</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                      </select>
                    </div>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={taskForm.isCritical} onChange={(e) => setTaskForm({ ...taskForm, isCritical: e.target.checked })} />
                      Critical Task
                    </label>
                    <div className="form-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowAddTask(null); setTaskForm(defaultTaskFormState); }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={taskFormLoading}>{taskFormLoading ? "Adding..." : "Add Task"}</button>
                    </div>
                  </form>
                ) : (
                  <button className="btn btn-outline add-task-btn" onClick={() => setShowAddTask(pkg.id)}>+ Add Task</button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Signatures */}
      {signatures.length > 0 && (
        <div className="card">
          <h2>Signatures</h2>
          <div className="signatures-list">
            {signatures.map((sig) => (
              <div key={sig.id} className="signature-item">
                <img src={sig.signatureData} alt={`${sig.signerName} signature`} className="signature-image" />
                <div className="signature-info">
                  <span className={`signature-type ${sig.signatureType.toLowerCase()}`}>{sig.signatureType}</span>
                  <strong>{sig.signerName}</strong>
                  {sig.signerTitle && <span className="muted">{sig.signerTitle}</span>}
                  <div className="signature-meta">{new Date(sig.signedAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Task Review Modal */}
      {showAIModal && aiModalData && (
        <AITaskReviewModal
          aiTaskPlan={aiModalData.aiTaskPlan}
          summary={aiModalData.summary}
          estimatedTotalDuration={aiModalData.estimatedTotalDuration}
          onClose={() => setShowAIModal(false)}
          onApproved={handleAITasksApproved}
          availableTechs={users}
        />
      )}
    </div>
  );
}
