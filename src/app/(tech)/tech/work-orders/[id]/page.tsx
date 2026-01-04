"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TaskInstance, WorkOrder, WorkPackage } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type ListResponse<T> = { data?: T[] };
type SingleResponse<T> = { data: T };
type TaskWithPackage = TaskInstance & { workPackage: WorkPackage };

const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
  SKIPPED: "Skipped",
};

export default function TechWorkOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [packages, setPackages] = useState<WorkPackage[]>([]);
  const [tasks, setTasks] = useState<TaskWithPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const [woRes, pkgRes, taskRes] = await Promise.all([
          apiFetch(`/api/work-orders/${id}`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${id}/packages`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${id}/tasks`, { cache: "no-store" }),
        ]);

        const woJson = await woRes.json().catch(() => ({}));
        const pkgJson = await pkgRes.json().catch(() => ({}));
        const taskJson = await taskRes.json().catch(() => ({}));

        if (!woRes.ok) throw new Error(woJson?.error ?? "Failed to load work order.");
        if (!pkgRes.ok) throw new Error(pkgJson?.error ?? "Failed to load packages.");
        if (!taskRes.ok) throw new Error(taskJson?.error ?? "Failed to load tasks.");

        if (cancelled) return;
        setWorkOrder((woJson as SingleResponse<WorkOrder>).data);
        setPackages((pkgJson as ListResponse<WorkPackage>).data ?? []);
        setTasks((taskJson as ListResponse<TaskWithPackage>).data ?? []);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  const grouped = useMemo(() => {
    const map: Record<string, TaskWithPackage[]> = {};
    for (const t of tasks) {
      map[t.workPackageId] = map[t.workPackageId] ?? [];
      map[t.workPackageId].push(t);
    }
    return map;
  }, [tasks]);

  if (!id) return <div className="card"><p>Missing work order id.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Work order</h2>
          <p>Tech execution view (assigned only).</p>
        </div>
        <Link className="link-button" href="/tech">← Back to My Work</Link>
      </div>

      {err && <div className="page-alert error">{err}</div>}
      {loading && !err && <div className="page-alert info">Loading…</div>}

      {workOrder && (
        <>
          <div className="card">
            <h3>
              {(workOrder as any).workOrderNumber
                ? `${(workOrder as any).workOrderNumber} — ${workOrder.title}`
                : workOrder.title}
            </h3>
            <p className="muted">{workOrder.description ?? "—"}</p>
          </div>

          <div className="card">
            <AttachmentsPanel entityType="workOrder" entityId={workOrder.id} />
          </div>
        </>
      )}

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
                  <p className="muted">No assigned tasks in this package.</p>
                ) : (
                  <ul className="task-list">
                    {pkgTasks.map((t) => (
                      <li key={t.id} className="task-item">
                        <div style={{ width: "100%" }}>
                          <div className="task-title-row">
                            <strong>{t.title}</strong>
                            <span className="task-chip">{taskStatusLabels[t.status]}</span>
                          </div>
                          {t.description ? <p className="muted">{t.description}</p> : null}
                          <AttachmentsPanel entityType="task" entityId={t.id} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
