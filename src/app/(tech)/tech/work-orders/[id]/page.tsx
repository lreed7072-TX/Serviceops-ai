"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type WorkOrderData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workOrderNumber: string | null;
  executionMode: string;
};

type PackageData = {
  id: string;
  name: string;
  packageType: string;
  status: string;
};

type TaskData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isCritical: boolean;
  workPackageId: string;
};

type TimerData = {
  id: string;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  taskInstanceId: string | null;
  currentSeconds: number;
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TechWorkOrderPage() {
  const params = useParams();
  const workOrderId = params?.id as string | undefined;

  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadTimer = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tech/timer", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTimer(json.data);
        if (json.data) setDisplaySeconds(json.data.currentSeconds);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!workOrderId) return;

    (async () => {
      try {
        setLoading(true);
        const [woRes, pkgRes, taskRes] = await Promise.all([
          apiFetch(`/api/work-orders/${workOrderId}`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/packages`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" }),
        ]);

        if (!woRes.ok) throw new Error("Failed to load work order");
        if (!pkgRes.ok) throw new Error("Failed to load packages");
        if (!taskRes.ok) throw new Error("Failed to load tasks");

        const woJson = await woRes.json();
        const pkgJson = await pkgRes.json();
        const taskJson = await taskRes.json();

        setWorkOrder(woJson.data);
        setPackages(pkgJson.data ?? []);
        setTasks(taskJson.data ?? []);

        await loadTimer();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [workOrderId, loadTimer]);

  // Live timer tick
  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;
    const interval = setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Group tasks by package
  const tasksByPackage: Record<string, TaskData[]> = {};
  tasks.forEach((t) => {
    if (!tasksByPackage[t.workPackageId]) tasksByPackage[t.workPackageId] = [];
    tasksByPackage[t.workPackageId].push(t);
  });

  // Sort tasks: in progress first, then todo, done last
  Object.keys(tasksByPackage).forEach((pkgId) => {
    tasksByPackage[pkgId].sort((a, b) => {
      const order: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, BLOCKED: 2, DONE: 3, SKIPPED: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });
  });

  if (!workOrderId) {
    return <div className="tech-container"><p>Missing work order ID.</p></div>;
  }

  return (
    <div className="tech-container">
      <div className="tech-header">
        <Link href="/tech" className="tech-back">← Back</Link>
        <h1>Work Order</h1>
      </div>

      {err && <div className="tech-alert error">{err}</div>}
      {loading && <div className="tech-alert info">Loading…</div>}

      {workOrder && (
        <>
          {/* Work Order Info */}
          <div className="tech-card">
            <div className="tech-card-header">
              <div>
                <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "4px" }}>
                  {workOrder.workOrderNumber || "Work Order"}
                </div>
                <h2 style={{ margin: 0 }}>{workOrder.title}</h2>
              </div>
              <span className={`tech-status ${workOrder.status.toLowerCase()}`}>
                {workOrder.status}
              </span>
            </div>
            {workOrder.description && (
              <p className="tech-description">{workOrder.description}</p>
            )}
          </div>

          {/* Packages & Tasks */}
          {packages.map((pkg) => {
            const pkgTasks = tasksByPackage[pkg.id] ?? [];
            const completedCount = pkgTasks.filter((t) => t.status === "DONE").length;

            return (
              <div key={pkg.id} className="tech-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, textTransform: "none", letterSpacing: "0" }}>{pkg.name}</h3>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                    {completedCount}/{pkgTasks.length} done
                  </span>
                </div>

                {pkgTasks.length === 0 ? (
                  <p className="muted">No tasks in this package.</p>
                ) : (
                  <ul className="tech-list">
                    {pkgTasks.map((t) => {
                      const isTimerOnThis = timer?.taskInstanceId === t.id && timer.status !== "STOPPED";

                      return (
                        <li key={t.id} className="tech-list-item">
                          <div className="tech-list-item-content">
                            <div className="tech-list-item-title">
                              {t.title}
                              {t.isCritical && <span className="tech-badge critical">Critical</span>}
                              {isTimerOnThis && timer?.status === "RUNNING" && (
                                <span className="timer-indicator running">{formatTime(displaySeconds)}</span>
                              )}
                              {isTimerOnThis && timer?.status === "PAUSED" && (
                                <span className="timer-indicator" style={{ background: "#fef3c7", color: "#92400e" }}>Paused</span>
                              )}
                            </div>
                            <div className="tech-list-item-meta">
                              <span className={`tech-status ${t.status.toLowerCase()}`} style={{ fontSize: "11px", padding: "2px 6px" }}>
                                {t.status.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                          <div className="tech-list-item-action">
                            <Link
                              href={`/tech/tasks/${t.id}`}
                              className="tech-btn primary"
                              style={{ padding: "10px 16px", fontSize: "13px" }}
                            >
                              {t.status === "DONE" ? "View" : "Open"}
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Attachments */}
          <div className="tech-card">
            <h3>Attachments</h3>
            <AttachmentsPanel entityType="workOrder" entityId={workOrderId} />
          </div>
        </>
      )}
    </div>
  );
}
