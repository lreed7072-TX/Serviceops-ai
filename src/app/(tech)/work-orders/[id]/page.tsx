"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { TaskStatus } from "@prisma/client";
import type { TaskInstance, WorkOrder, WorkPackage } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type SingleResponse<T> = { data: T };
type ListResponse<T> = { data?: T[] };
type TaskWithPackage = TaskInstance & { workPackage: WorkPackage };

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

export default function TechWorkOrderDetailPage() {
  const params = useParams();
  const workOrderId = params?.id as string | undefined;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [packages, setPackages] = useState<WorkPackage[]>([]);
  const [tasks, setTasks] = useState<TaskWithPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [noteErr, setNoteErr] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!workOrderId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const [woRes, pkgRes, taskRes] = await Promise.all([
          apiFetch(`/api/work-orders/${workOrderId}`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/packages`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" }),
        ]);

        if (!woRes.ok) throw new Error((await woRes.json())?.error ?? "Failed to load work order.");
        if (!pkgRes.ok) throw new Error((await pkgRes.json())?.error ?? "Failed to load packages.");
        if (!taskRes.ok) throw new Error((await taskRes.json())?.error ?? "Failed to load tasks.");

        const wo = (await woRes.json()) as SingleResponse<WorkOrder>;
        const pkgs = (await pkgRes.json()) as ListResponse<WorkPackage>;
        const t = (await taskRes.json()) as ListResponse<TaskWithPackage>;

        if (cancelled) return;
        setWorkOrder(wo.data);
        setPackages(pkgs.data ?? []);
        setTasks(t.data ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load.");
        setWorkOrder(null);
        setPackages([]);
        setTasks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const grouped = useMemo(() => {
    const map: Record<string, TaskWithPackage[]> = {};
    tasks.forEach((t) => {
      (map[t.workPackageId] ??= []).push(t);
    });
    Object.values(map).forEach((arr) => {
      arr.sort((a, b) => {
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
    const res = await apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" });
    if (!res.ok) return;
    const payload = (await res.json()) as ListResponse<TaskWithPackage>;
    setTasks(payload.data ?? []);
  };

  const setLoadingFor = (taskId: string, v: boolean) =>
    setActionLoading((prev) => ({ ...prev, [taskId]: v }));

  const advanceStatus = async (task: TaskWithPackage) => {
    const next = nextStatusMap[task.status];
    if (!next) return;

    setLoadingFor(task.id, true);
    try {
      const res = await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Update failed.");
      await refreshTasks();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFor(task.id, false);
    }
  };

  const addNoteEvidence = async (taskId: string, e: FormEvent) => {
    e.preventDefault();
    const text = (noteDraft[taskId] ?? "").trim();
    if (!text) return;

    setNoteErr((p) => ({ ...p, [taskId]: null }));
    setLoadingFor(taskId, true);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "NOTE", noteText: text }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed to add note.");
      setNoteDraft((p) => ({ ...p, [taskId]: "" }));
    } catch (e: any) {
      setNoteErr((p) => ({ ...p, [taskId]: e?.message ?? "Failed to add note." }));
    } finally {
      setLoadingFor(taskId, false);
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
          <h2>Work order</h2>
          <p>Tech execution view (tasks, evidence, attachments).</p>
        </div>
        <Link className="link-button" href="/tech">
          ← Back to My Work
        </Link>
      </div>

      {err && <div className="page-alert error">{err}</div>}
      {loading && !err && <div className="page-alert info">Loading…</div>}

      {workOrder && (
        <>
          <div className="card">
            <h3>
              {(workOrder as any).workOrderNumber ? `${(workOrder as any).workOrderNumber} — ` : ""}
              {workOrder.title}
            </h3>
            <p>{workOrder.description ?? "—"}</p>
          </div>

          <AttachmentsPanel entityType="workOrder" entityId={workOrder.id} />

          <div className="card">
            <h3>Packages & tasks</h3>

            {packages.length === 0 ? (
              <p className="muted">No packages.</p>
            ) : (
              packages.map((pkg) => {
                const pkgTasks = grouped[pkg.id] ?? [];
                return (
                  <div key={pkg.id} className="package-block">
                    <div className="package-block-header">
                      <div>
                        <h4>{pkg.name}</h4>
                        <p className="muted">{pkg.packageType}</p>
                      </div>
                    </div>

                    {pkgTasks.length === 0 ? (
                      <p className="muted">No tasks.</p>
                    ) : (
                      <ul className="task-list">
                        {pkgTasks.map((task) => {
                          const busy = Boolean(actionLoading[task.id]);
                          const next = nextStatusMap[task.status];

                          return (
                            <li key={task.id} className="task-item">
                              <div style={{ width: "100%" }}>
                                <div className="task-title-row">
                                  <strong>{task.title}</strong>
                                  {task.isCritical && <span className="task-chip">Critical</span>}
                                </div>

                                {task.description ? <p>{task.description}</p> : null}

                                <div className="task-meta-row">
                                  <span className={`task-status status-${task.status.toLowerCase()}`}>
                                    {taskStatusLabels[task.status]}
                                  </span>

                                  <div className="task-actions">
                                    {next ? (
                                      <button
                                        type="button"
                                        className="link-button"
                                        onClick={() => advanceStatus(task)}
                                        disabled={busy}
                                      >
                                        {task.status === TaskStatus.TODO ? "Start" : "Mark done"}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                <div style={{ marginTop: 10 }}>
                                  <form onSubmit={(e) => addNoteEvidence(task.id, e)} style={{ display: "grid", gap: 8 }}>
                                    <label className="form-field">
                                      <span>Add note</span>
                                      <input
                                        value={noteDraft[task.id] ?? ""}
                                        onChange={(e) => setNoteDraft((p) => ({ ...p, [task.id]: e.target.value }))}
                                        placeholder="Observation, reading, issue, next step…"
                                        disabled={busy}
                                      />
                                    </label>
                                    {noteErr[task.id] ? <p className="form-feedback error">{noteErr[task.id]}</p> : null}
                                    <div className="form-actions">
                                      <button type="submit" disabled={busy || !(noteDraft[task.id] ?? "").trim()}>
                                        {busy ? "Saving…" : "Add note"}
                                      </button>
                                    </div>
                                  </form>
                                </div>

                                <div style={{ marginTop: 14 }}>
                                  <AttachmentsPanel entityType="task" entityId={task.id} />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
