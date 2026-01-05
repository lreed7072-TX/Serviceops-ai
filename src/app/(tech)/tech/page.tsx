"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

type WorkOrderRow = {
  id: string;
  title: string;
  status: string;
  workOrderNumber?: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  isCritical: boolean;
  workOrder: { id: string; title: string; workOrderNumber?: string | null };
  workPackage: { id: string; name: string };
};

type TimerData = {
  id: string;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  taskInstanceId: string | null;
  workOrderId: string;
  currentSeconds: number;
  taskInstance?: { id: string; title: string } | null;
  workOrder?: { id: string; title: string; workOrderNumber?: string | null };
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

async function fetchList<T>(path: string): Promise<T[]> {
  const res = await fetch(path, { cache: "no-store", credentials: "include" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export default function TechHomePage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadTimer = useCallback(async () => {
    try {
      const res = await fetch("/api/tech/timer", { cache: "no-store", credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setTimer(json.data);
        if (json.data) {
          setDisplaySeconds(json.data.currentSeconds);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [wo, t] = await Promise.all([
          fetchList<WorkOrderRow>("/api/work-orders"),
          fetchList<TaskRow>("/api/tech/tasks"),
        ]);
        setWorkOrders(wo);
        setTasks(t);
        await loadTimer();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTimer]);

  // Live timer tick
  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;
    const interval = setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Sort tasks: in progress first, then todo, done last
  const sortedTasks = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, BLOCKED: 2, DONE: 3, SKIPPED: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  const incompleteTasks = sortedTasks.filter((t) => t.status !== "DONE" && t.status !== "SKIPPED");

  return (
    <div className="tech-container">
      <div className="tech-header">
        <h1>My Work</h1>
      </div>

      {err && <div className="tech-alert error">{err}</div>}
      {loading && <div className="tech-alert info">Loading…</div>}

      {/* Active Timer Banner */}
      {timer && (timer.status === "RUNNING" || timer.status === "PAUSED") && (
        <div className="tech-card timer-card" style={{ padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="timer-indicator running">
                {timer.status === "RUNNING" ? "Timer Running" : "Timer Paused"}
              </div>
              <div style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>
                {timer.taskInstance?.title || timer.workOrder?.workOrderNumber || "Work Order"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="timer-time" style={{ fontSize: "28px" }}>
                {formatTime(displaySeconds)}
              </span>
              {timer.taskInstanceId && (
                <Link
                  href={`/tech/tasks/${timer.taskInstanceId}`}
                  className="tech-btn primary"
                  style={{ marginTop: "8px", display: "block", padding: "8px 16px", fontSize: "13px" }}
                >
                  Open Task
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="tech-card tech-dashboard-card">
        <h3>My Tasks ({incompleteTasks.length})</h3>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : incompleteTasks.length === 0 ? (
          <p className="muted">No tasks assigned.</p>
        ) : (
          <ul className="tech-list">
            {incompleteTasks.map((t) => (
              <li key={t.id} className="tech-list-item">
                <div className="tech-list-item-content">
                  <div className="tech-list-item-title">
                    {t.title}
                    {t.isCritical && <span className="tech-badge critical">Critical</span>}
                    {timer?.taskInstanceId === t.id && timer.status === "RUNNING" && (
                      <span className="timer-indicator running">{formatTime(displaySeconds)}</span>
                    )}
                  </div>
                  <div className="tech-list-item-meta">
                    <span className={`tech-status ${t.status.toLowerCase()}`} style={{ fontSize: "11px", padding: "2px 6px" }}>
                      {t.status.replace("_", " ")}
                    </span>
                    <span style={{ marginLeft: "8px" }}>
                      {t.workOrder.workOrderNumber || t.workOrder.title}
                    </span>
                  </div>
                </div>
                <div className="tech-list-item-action">
                  <Link href={`/tech/tasks/${t.id}`} className="tech-btn primary" style={{ padding: "10px 16px", fontSize: "13px" }}>
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Work Orders */}
      <div className="tech-card tech-dashboard-card">
        <h3>Work Orders ({workOrders.length})</h3>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : workOrders.length === 0 ? (
          <p className="muted">No work orders assigned.</p>
        ) : (
          <ul className="tech-list">
            {workOrders.slice(0, 5).map((wo) => (
              <li key={wo.id} className="tech-list-item">
                <div className="tech-list-item-content">
                  <div className="tech-list-item-title">{wo.workOrderNumber || "WO"}</div>
                  <div className="tech-list-item-meta">{wo.title}</div>
                </div>
                <div className="tech-list-item-action">
                  <Link href={`/tech/work-orders/${wo.id}`} className="tech-btn primary" style={{ padding: "10px 16px", fontSize: "13px" }}>
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {workOrders.length > 5 && (
          <p className="muted" style={{ marginTop: "12px", textAlign: "center" }}>
            +{workOrders.length - 5} more
          </p>
        )}
      </div>
    </div>
  );
}
