"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { TaskStatus } from "@prisma/client";
import type { TaskInstance, WorkOrder, WorkPackage, User } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type SingleResponse<T> = {
  data: T;
};

type ListResponse<T> = {
  data?: T[];
};

type TaskWithPackage = TaskInstance & { workPackage: WorkPackage };

type TaskFormState = {
    title: string;
    description: string;
    assignedToId: string;
    isCritical: boolean;
  };

type TaskEditState = TaskFormState & {
  sequenceNumber: string;
};

const executionModeLabels: Record<WorkOrder["executionMode"], string> = {
  UNIFIED: "Unified",
  MULTI_LANE: "Multi-lane",
};

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
  SKIPPED: "Skipped",
};

const nextStatusMap: Record<TaskStatus, TaskStatus | null> = {
  TODO: TaskStatus.IN_PROGRESS,
  IN_PROGRESS: TaskStatus.DONE,
  DONE: null,
  BLOCKED: null,
  SKIPPED: null,
};

const defaultTaskFormState: TaskFormState = {
    title: "",
    description: "",
    assignedToId: "",
    isCritical: false,
  };

export default function WorkOrderDetailPage() {
  const params = useParams();
  const workOrderId = params?.id as string | undefined;
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [packages, setPackages] = useState<WorkPackage[]>([]);
    const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskWithPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskForms, setTaskForms] = useState<Record<string, TaskFormState>>({});
  const [taskFormErrors, setTaskFormErrors] = useState<Record<string, string | null>>({});
  const [taskFormLoading, setTaskFormLoading] = useState<Record<string, boolean>>({});
  const [taskActionLoading, setTaskActionLoading] = useState<Record<string, boolean>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskValues, setEditingTaskValues] = useState<TaskEditState | null>(null);

  useEffect(() => {
    if (!workOrderId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [workOrderRes, packagesRes, tasksRes, usersRes] = await Promise.all([
          apiFetch(`/api/work-orders/${workOrderId}`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/packages`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" }),
            apiFetch(`/api/users`, { cache: "no-store" }),
        ]);

        if (!workOrderRes.ok) {
          const payload = (await workOrderRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load work order.");
        }
        if (!packagesRes.ok) {
          const payload = (await packagesRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load packages.");
        }
        if (!usersRes.ok) {
            const payload = (await usersRes.json()) as { error?: string };
            throw new Error(payload.error ?? "Failed to load users.");
          }
          if (!tasksRes.ok) {
          const payload = (await tasksRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load tasks.");
        }

        const workOrderPayload = (await workOrderRes.json()) as SingleResponse<WorkOrder>;
        const packagesPayload = (await packagesRes.json()) as ListResponse<WorkPackage>;
        const tasksPayload = (await tasksRes.json()) as ListResponse<TaskWithPackage>;
          const usersPayload = (await usersRes.json()) as ListResponse<User>;

        if (cancelled) return;
        setWorkOrder(workOrderPayload.data);
        setPackages(packagesPayload.data ?? []);
        setTasks(tasksPayload.data ?? []);
          setUsers(usersPayload.data ?? []);
        setError(null);
        setTaskError(null);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        const message = err instanceof Error ? err.message : "Failed to load work order.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const groupedTasks = useMemo(() => {
    const map: Record<string, TaskWithPackage[]> = {};
    tasks.forEach((task) => {
      if (!map[task.workPackageId]) {
        map[task.workPackageId] = [];
      }
      map[task.workPackageId].push(task);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        if (a.sequenceNumber == null && b.sequenceNumber != null) return 1;
        if (a.sequenceNumber != null && b.sequenceNumber == null) return -1;
        if (a.sequenceNumber != null && b.sequenceNumber != null && a.sequenceNumber !== b.sequenceNumber) {
          return a.sequenceNumber - b.sequenceNumber;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    });
    return map;
  }, [tasks]);

  const refreshTasks = async () => {
    if (!workOrderId) return;
    try {
      const response = await apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load tasks.");
      }
      const payload = (await response.json()) as ListResponse<TaskWithPackage>;
      setTasks(payload.data ?? []);
      setTaskError(null);
    } catch (err) {
      console.error(err);
      setTaskError(err instanceof Error ? err.message : "Failed to load tasks.");
    }
  };

  const getTaskFormState = (packageId: string): TaskFormState =>
    taskForms[packageId] ?? { ...defaultTaskFormState };

  const handleTaskFormChange = (
    packageId: string,
    field: keyof TaskFormState,
    value: string | boolean
  ) => {
    setTaskForms((prev) => {
      const current = prev[packageId] ?? { ...defaultTaskFormState };
      const updated: TaskFormState = {
        ...current,
        [field]: field === "isCritical" ? Boolean(value) : (value as string),
      };
      return { ...prev, [packageId]: updated };
    });
  };

  const handleAddTask = async (packageId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formState = getTaskFormState(packageId);
    if (!formState.title.trim()) {
      setTaskFormErrors((prev) => ({ ...prev, [packageId]: "Task title is required." }));
      return;
    }

    setTaskFormErrors((prev) => ({ ...prev, [packageId]: null }));
    setTaskFormLoading((prev) => ({ ...prev, [packageId]: true }));
    setTaskError(null);

    try {
      const response = await apiFetch(`/api/work-packages/${packageId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formState.title.trim(),
          description: formState.description.trim() ? formState.description.trim() : null,
          assignedToId: formState.assignedToId.trim() ? formState.assignedToId.trim() : null,
            isCritical: formState.isCritical,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to add task.");
      }

      setTaskForms((prev) => ({ ...prev, [packageId]: { ...defaultTaskFormState } }));
      await refreshTasks();
    } catch (err) {
      console.error(err);
      setTaskFormErrors((prev) => ({
        ...prev,
        [packageId]: err instanceof Error ? err.message : "Failed to add task.",
      }));
    } finally {
      setTaskFormLoading((prev) => ({ ...prev, [packageId]: false }));
    }
  };

  const setTaskActionLoadingState = (taskId: string, value: boolean) => {
    setTaskActionLoading((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleAdvanceStatus = async (task: TaskWithPackage) => {
    const nextStatus = nextStatusMap[task.status];
    if (!nextStatus) return;

    setTaskError(null);
    setTaskActionLoadingState(task.id, true);
    try {
      const response = await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to update task.");
      }
      await refreshTasks();
    } catch (err) {
      console.error(err);
      setTaskError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setTaskActionLoadingState(task.id, false);
    }
  };

  const startEditingTask = (task: TaskWithPackage) => {
    setEditingTaskId(task.id);
    setEditingTaskValues({
      title: task.title,
      description: task.description ?? "",
      isCritical: task.isCritical,
      sequenceNumber: task.sequenceNumber != null ? String(task.sequenceNumber) : "",
    });
    setTaskError(null);
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditingTaskValues(null);
  };

  const handleEditFieldChange = (
    field: keyof TaskEditState,
    value: string | boolean
  ) => {
    setEditingTaskValues((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: field === "isCritical" ? Boolean(value) : (value as string),
      };
    });
  };

  const handleEditSubmit = async (
    event: FormEvent<HTMLFormElement>,
    taskId: string
  ) => {
    event.preventDefault();
    if (!editingTaskValues) return;

    if (!editingTaskValues.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    let sequenceNumber: number | null = null;
    if (editingTaskValues.sequenceNumber.trim().length > 0) {
      const parsed = Number(editingTaskValues.sequenceNumber);
      if (Number.isNaN(parsed)) {
        setTaskError("Sequence number must be a valid number.");
        return;
      }
      sequenceNumber = parsed;
    }

    setTaskError(null);
    setTaskActionLoadingState(taskId, true);

    try {
      const response = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTaskValues.title.trim(),
          description: editingTaskValues.description.trim()
            ? editingTaskValues.description.trim()
            : null,
          isCritical: editingTaskValues.isCritical,
          sequenceNumber,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to update task.");
      }

      setEditingTaskId(null);
      setEditingTaskValues(null);
      await refreshTasks();
    } catch (err) {
      console.error(err);
      setTaskError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setTaskActionLoadingState(taskId, false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTaskError(null);
    setTaskActionLoadingState(taskId, true);
    try {
      const response = await apiFetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete task.");
      }
      await refreshTasks();
    } catch (err) {
      console.error(err);
      setTaskError(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setTaskActionLoadingState(taskId, false);
    }
  };

  if (!workOrderId) {
    return (
      <div className="card">
        <p>Missing work order ID in URL.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Work order detail</h2>
          <p>Track packages and execution lanes.</p>
        </div>
        <Link className="link-button" href="/work-orders">
          ← Back to list
        </Link>
      </div>

      {error && <div className="page-alert error">{error}</div>}
      {loading && !error && <div className="page-alert info">Loading work order…</div>}

      {workOrder && (
        <div className="card">
          <h3>{workOrder.title}</h3>
          <p>{workOrder.description ?? "No description provided."}</p>
          <dl className="detail-grid">
              <div>
                <dt>WO #</dt>
                <dd>{(workOrder as any).workOrderNumber ?? "—"}</dd>
              </div>
            <div>
              <dt>Status</dt>
              <dd>{workOrder.status}</dd>
            </div>
            <div>
              <dt>Execution mode</dt>
              <dd>{executionModeLabels[workOrder.executionMode]}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{new Date(workOrder.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}


        <AttachmentsPanel entityType="workOrder" entityId={workOrderId} />

      <div className="card">
        <h3>Packages & tasks</h3>
        {taskError && <p className="form-feedback error">{taskError}</p>}
        {loading ? (
          <p>Loading packages…</p>
        ) : packages.length === 0 ? (
          <p>No work packages yet.</p>
        ) : (
          packages.map((pkg) => {
            const pkgTasks = groupedTasks[pkg.id] ?? [];
            const formState = getTaskFormState(pkg.id);
            const formError = taskFormErrors[pkg.id];
            const formLoading = Boolean(taskFormLoading[pkg.id]);

            return (
              <div key={pkg.id} className="package-block">
                <div className="package-block-header">
                  <div>
                    <h4>{pkg.name}</h4>
                    <p className="muted">{pkg.packageType}</p>
                  </div>
                  <div className="package-meta">
                    <span>Status: {pkg.status}</span>
                    <span>Lead: {pkg.leadTechId ?? "Unassigned"}</span>
                  </div>
                </div>

                <div className="tasks-section">
                  {pkgTasks.length === 0 ? (
                    <p className="muted">No tasks yet.</p>
                  ) : (
                    <ul className="task-list">
                      {pkgTasks.map((task) => {
                        const statusClass = `status-${task.status.toLowerCase()}`;
                        const nextStatus = nextStatusMap[task.status];
                        const actionLoading = Boolean(taskActionLoading[task.id]);

                        if (editingTaskId === task.id && editingTaskValues) {
                          return (
                            <li key={task.id} className="task-item">
                              <form
                                className="task-edit-form"
                                onSubmit={(event) => handleEditSubmit(event, task.id)}
                              >
                                <label className="form-field">
                                  <span>Title</span>
                                  <input
                                    value={editingTaskValues.title}
                                    onChange={(event) =>
                                      handleEditFieldChange("title", event.target.value)
                                    }
                                    required
                                  />
                                </label>
                                <label className="form-field">
                                  <span>Description</span>
                                  <textarea
                                    rows={2}
                                    value={editingTaskValues.description}
                                    onChange={(event) =>
                                      handleEditFieldChange("description", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="form-field">
                                  <span>Sequence number</span>
                                  <input
                                    type="number"
                                    value={editingTaskValues.sequenceNumber}
                                    onChange={(event) =>
                                      handleEditFieldChange("sequenceNumber", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="checkbox-field">
                                  <input
                                    type="checkbox"
                                    checked={editingTaskValues.isCritical}
                                    onChange={(event) =>
                                      handleEditFieldChange("isCritical", event.target.checked)
                                    }
                                  />
                                  <span>Critical</span>
                                </label>
                                <div className="task-edit-actions">
                                  <button
                                    type="button"
                                    className="link-button"
                                    onClick={cancelEditingTask}
                                    disabled={actionLoading}
                                  >
                                    Cancel
                                  </button>
                                  <button type="submit" disabled={actionLoading}>
                                    {actionLoading ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </form>
                            </li>
                          );
                        }

                        return (
                          <li key={task.id} className="task-item">
                            <div>
                              <div className="task-title-row">
                                <strong>{task.title}</strong>
                                {task.isCritical && <span className="task-chip">Critical</span>}
                              </div>
                              {task.description && <p>{task.description}</p>}
                            </div>
                            <div className="task-meta-row">
                              <span className={`task-status ${statusClass}`}>
                                {taskStatusLabels[task.status]}
                              </span>
                              <div className="task-actions">
                                {nextStatus && (
                                  <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => handleAdvanceStatus(task)}
                                    disabled={actionLoading}
                                  >
                                    {task.status === TaskStatus.TODO
                                      ? "Start"
                                      : "Mark done"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="link-button"
                                  onClick={() => startEditingTask(task)}
                                  disabled={actionLoading}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="link-button danger"
                                  onClick={() => handleDeleteTask(task.id)}
                                  disabled={actionLoading}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <form
                  className="task-inline-form"
                  onSubmit={(event) => handleAddTask(pkg.id, event)}
                >
                  <label className="form-field">
                    <span>Task title</span>
                    <input
                      value={formState.title}
                      onChange={(event) =>
                        handleTaskFormChange(pkg.id, "title", event.target.value)
                      }
                      placeholder="Describe the task"
                      required
                    />
                  </label>
                  <label className="form-field">
                    <span>Description</span>
                    <textarea
                      rows={2}
                      value={formState.description}
                      onChange={(event) =>
                        handleTaskFormChange(pkg.id, "description", event.target.value)
                      }
                      placeholder="Optional details"
                    />
                  </label>
                  
                    <label className="form-field">
                      <span>Assign technician</span>
                      <select
                        value={formState.assignedToId}
                        onChange={(event) =>
                          handleTaskFormChange(pkg.id, "assignedToId", event.target.value)
                        }
                        disabled={formLoading}
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {(u.name && u.name.trim().length ? u.name : u.email) + ` (${u.role})`}
                          </option>
                        ))}
                      </select>
                    </label>

<label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formState.isCritical}
                      onChange={(event) =>
                        handleTaskFormChange(pkg.id, "isCritical", event.target.checked)
                      }
                    />
                    <span>Critical</span>
                  </label>
                  {formError && <p className="form-feedback error">{formError}</p>}
                  <button type="submit" disabled={formLoading}>
                    {formLoading ? "Adding…" : "Add task"}
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
