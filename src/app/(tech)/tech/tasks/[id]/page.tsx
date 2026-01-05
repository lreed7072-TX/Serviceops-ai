"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type TaskData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isCritical: boolean;
  workOrderId: string;
  workPackageId: string;
  workOrder?: { id: string; title: string; workOrderNumber: string | null };
  workPackage?: { id: string; name: string };
};

type TimerData = {
  id: string;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  taskInstanceId: string | null;
  workOrderId: string;
  currentSeconds: number;
  accumulatedSeconds: number;
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

export default function TechTaskPage() {
  const params = useParams();
  const taskId = params?.id as string | undefined;

  const [task, setTask] = useState<TaskData | null>(null);
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Load task data
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.text()) || "Failed to load task");
      const json = await res.json();
      setTask(json.data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load task");
    }
  }, [taskId]);

  // Load active timer
  const loadTimer = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tech/timer", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load timer");
      const json = await res.json();
      setTimer(json.data);
      if (json.data) {
        setDisplaySeconds(json.data.currentSeconds);
      }
    } catch (e) {
      // Timer fetch errors are non-fatal
      console.error(e);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTask(), loadTimer()]).finally(() => setLoading(false));
  }, [loadTask, loadTimer]);

  // Live timer tick
  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;

    const interval = setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // Check if this task's timer is active
  const isTimerForThisTask =
    timer && timer.taskInstanceId === taskId && timer.status !== "STOPPED";
  const isRunning = timer?.status === "RUNNING" && isTimerForThisTask;
  const isPaused = timer?.status === "PAUSED" && isTimerForThisTask;

  // Timer actions
  const startTimer = async () => {
    if (!task) return;
    setActionLoading(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/tech/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: task.workOrderId,
          taskInstanceId: task.id,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to start timer");
      await loadTimer();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start timer");
    } finally {
      setActionLoading(false);
    }
  };

  const pauseTimer = async () => {
    setActionLoading(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/tech/timer/pause", { method: "POST" });
      if (!res.ok) throw new Error((await res.text()) || "Failed to pause timer");
      await loadTimer();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to pause timer");
    } finally {
      setActionLoading(false);
    }
  };

  const resumeTimer = async () => {
    setActionLoading(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/tech/timer/resume", { method: "POST" });
      if (!res.ok) throw new Error((await res.text()) || "Failed to resume timer");
      await loadTimer();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to resume timer");
    } finally {
      setActionLoading(false);
    }
  };

  const stopTimer = async () => {
    setActionLoading(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/tech/timer/stop", { method: "POST" });
      if (!res.ok) throw new Error((await res.text()) || "Failed to stop timer");
      await loadTimer();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to stop timer");
    } finally {
      setActionLoading(false);
    }
  };

  // Task status actions
  const setTaskStatus = async (status: string) => {
    if (!taskId) return;
    setActionLoading(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to update status");
      await loadTask();

      // Auto-stop timer when marking done
      if (status === "DONE" && isTimerForThisTask) {
        await stopTimer();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  // Add note
  const addNote = async () => {
    if (!taskId || !noteText.trim()) return;
    setNoteSaving(true);
    setNoteSuccess(false);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "NOTE", noteText: noteText.trim() }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to add note");
      setNoteText("");
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 2000);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  if (!taskId) {
    return <div className="tech-container"><p>Missing task ID.</p></div>;
  }

  return (
    <div className="tech-container">
      {/* Header */}
      <div className="tech-header">
        <Link href="/tech" className="tech-back">← Back</Link>
        <h1>Task</h1>
      </div>

      {err && <div className="tech-alert error">{err}</div>}
      {loading && <div className="tech-alert info">Loading…</div>}

      {task && (
        <>
          {/* Task Info Card */}
          <div className="tech-card">
            <div className="tech-card-header">
              <h2>{task.title}</h2>
              {task.isCritical && <span className="tech-badge critical">Critical</span>}
            </div>
            {task.description && <p className="tech-description">{task.description}</p>}
            
            <div className="tech-meta">
              <span className={`tech-status ${task.status.toLowerCase()}`}>
                {task.status.replace("_", " ")}
              </span>
              {task.workOrder && (
                <span className="tech-wo">
                  WO: {task.workOrder.workOrderNumber || task.workOrder.title}
                </span>
              )}
            </div>
          </div>

          {/* Timer Card */}
          <div className="tech-card timer-card">
            <div className="timer-display">
              <span className="timer-time">
                {isTimerForThisTask ? formatTime(displaySeconds) : "0:00"}
              </span>
              <span className="timer-label">
                {isRunning ? "Running" : isPaused ? "Paused" : "Not started"}
              </span>
            </div>

            <div className="timer-controls">
              {!isTimerForThisTask && (
                <button
                  className="tech-btn primary large"
                  onClick={startTimer}
                  disabled={actionLoading}
                >
                  ▶ Start Timer
                </button>
              )}

              {isRunning && (
                <button
                  className="tech-btn warning large"
                  onClick={pauseTimer}
                  disabled={actionLoading}
                >
                  ⏸ Pause
                </button>
              )}

              {isPaused && (
                <>
                  <button
                    className="tech-btn primary large"
                    onClick={resumeTimer}
                    disabled={actionLoading}
                  >
                    ▶ Resume
                  </button>
                  <button
                    className="tech-btn danger"
                    onClick={stopTimer}
                    disabled={actionLoading}
                  >
                    ⏹ Stop
                  </button>
                </>
              )}

              {isRunning && (
                <button
                  className="tech-btn danger"
                  onClick={stopTimer}
                  disabled={actionLoading}
                >
                  ⏹ Stop
                </button>
              )}
            </div>
          </div>

          {/* Task Status Actions */}
          <div className="tech-card">
            <h3>Update Status</h3>
            <div className="status-grid">
              {task.status === "TODO" && (
                <button
                  className="tech-btn primary"
                  onClick={() => setTaskStatus("IN_PROGRESS")}
                  disabled={actionLoading}
                >
                  Start Task
                </button>
              )}
              {task.status === "IN_PROGRESS" && (
                <>
                  <button
                    className="tech-btn success"
                    onClick={() => setTaskStatus("DONE")}
                    disabled={actionLoading}
                  >
                    ✓ Mark Done
                  </button>
                  <button
                    className="tech-btn warning"
                    onClick={() => setTaskStatus("BLOCKED")}
                    disabled={actionLoading}
                  >
                    ⚠ Blocked
                  </button>
                </>
              )}
              {task.status === "BLOCKED" && (
                <>
                  <button
                    className="tech-btn primary"
                    onClick={() => setTaskStatus("IN_PROGRESS")}
                    disabled={actionLoading}
                  >
                    Resume
                  </button>
                  <button
                    className="tech-btn success"
                    onClick={() => setTaskStatus("DONE")}
                    disabled={actionLoading}
                  >
                    ✓ Mark Done
                  </button>
                </>
              )}
              {task.status === "DONE" && (
                <p className="tech-complete">✓ Task completed</p>
              )}
            </div>
          </div>

          {/* Quick Note */}
          <div className="tech-card">
            <h3>Add Note</h3>
            <textarea
              className="tech-textarea"
              placeholder="Add a note about this task..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
            />
            <button
              className="tech-btn primary"
              onClick={addNote}
              disabled={noteSaving || !noteText.trim()}
            >
              {noteSaving ? "Saving…" : "Save Note"}
            </button>
            {noteSuccess && <span className="note-success">✓ Saved</span>}
          </div>

          {/* Attachments */}
          <div className="tech-card">
            <h3>Photos & Files</h3>
            <AttachmentsPanel entityType="task" entityId={task.id} />
          </div>
        </>
      )}
    </div>
  );
}
