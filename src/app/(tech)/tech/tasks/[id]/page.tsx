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

type EvidenceData = {
  id: string;
  type: "NOTE" | "PHOTO" | "FILE";
  noteText: string | null;
  url: string | null;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string };
};

type MeasurementData = {
  id: string;
  name: string;
  unit: string | null;
  measurementType: "NUMERIC" | "PASS_FAIL" | "TEXT";
  minValue: number | null;
  maxValue: number | null;
  numericValue: number | null;
  textValue: string | null;
  passFail: boolean | null;
  isWithinSpec: boolean | null;
  capturedAt: string | null;
  capturedByUser: { id: string; name: string | null; email: string } | null;
};

type MaterialUsageData = {
  id: string;
  name: string;
  partNumber: string | null;
  quantity: number;
  unitCost: number | null;
  unit: string | null;
  totalCost: number | null;
  notes: string | null;
  addedAt: string;
  addedByUser: { id: string; name: string | null; email: string } | null;
};

type MaterialCatalog = {
  id: string;
  name: string;
  partNumber: string | null;
  unitCost: number | null;
  unit: string | null;
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TechTaskPage() {
  const params = useParams();
  const taskId = params?.id as string | undefined;

  const [task, setTask] = useState<TaskData | null>(null);
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [evidence, setEvidence] = useState<EvidenceData[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState<string | null>(null);

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
      console.error(e);
    }
  }, []);

  // Load evidence (notes, photos, files)
  const loadEvidence = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/evidence`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load evidence");
      const json = await res.json();
      setEvidence(json.data ?? []);
    } catch (e) {
      console.error(e);
    }
  }, [taskId]);

  // Load measurements
  const loadMeasurements = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/measurements`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load measurements");
      const json = await res.json();
      setMeasurements(json.data ?? []);
    } catch (e) {
      console.error(e);
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTask(), loadTimer(), loadEvidence(), loadMeasurements()]).finally(() => setLoading(false));
  }, [loadTask, loadTimer, loadEvidence, loadMeasurements]);

  // Live timer tick
  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;
    const interval = setInterval(() => {
      setDisplaySeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Check if this task's timer is active
  const isTimerForThisTask = timer && timer.taskInstanceId === taskId && timer.status !== "STOPPED";
  const isRunning = timer?.status === "RUNNING" && isTimerForThisTask;
  const isPaused = timer?.status === "PAUSED" && isTimerForThisTask;

  // Timer actions
  const startTimer = async () => {
    if (!task) return;
    const res = await apiFetch("/api/tech/timer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workOrderId: task.workOrderId, taskInstanceId: task.id }),
    });
    if (!res.ok) throw new Error((await res.text()) || "Failed to start timer");
    await loadTimer();
  };

  const pauseTimer = async () => {
    const res = await apiFetch("/api/tech/timer/pause", { method: "POST" });
    if (!res.ok) throw new Error((await res.text()) || "Failed to pause timer");
    await loadTimer();
  };

  const resumeTimer = async () => {
    const res = await apiFetch("/api/tech/timer/resume", { method: "POST" });
    if (!res.ok) throw new Error((await res.text()) || "Failed to resume timer");
    await loadTimer();
  };

  const stopTimer = async () => {
    const res = await apiFetch("/api/tech/timer/stop", { method: "POST" });
    if (!res.ok) throw new Error((await res.text()) || "Failed to stop timer");
    await loadTimer();
  };

  // Combined Task Status + Timer Actions
  const startTask = async () => {
    if (!taskId || !task) return;
    setActionLoading(true);
    setErr(null);
    try {
      await startTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to start task");
      await loadTask();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to start task");
    } finally {
      setActionLoading(false);
    }
  };

  const pauseTask = async () => {
    if (!taskId) return;
    setActionLoading(true);
    setErr(null);
    try {
      if (isRunning) await pauseTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "BLOCKED" }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to pause task");
      await loadTask();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to pause task");
    } finally {
      setActionLoading(false);
    }
  };

  const resumeTask = async () => {
    if (!taskId || !task) return;
    setActionLoading(true);
    setErr(null);
    try {
      if (isPaused) await resumeTimer();
      else if (!isTimerForThisTask) await startTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to resume task");
      await loadTask();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to resume task");
    } finally {
      setActionLoading(false);
    }
  };

  const completeTask = async () => {
    if (!taskId) return;
    setActionLoading(true);
    setErr(null);
    try {
      if (isTimerForThisTask) await stopTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Failed to complete task");
      await loadTask();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to complete task");
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
      await loadEvidence();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  };

  // Save measurement value
  const saveMeasurement = async (
    measurement: MeasurementData,
    value: { numericValue?: number | null; textValue?: string | null; passFail?: boolean | null }
  ) => {
    if (!taskId) return;
    setSavingMeasurement(measurement.id);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measurementId: measurement.id, ...value }),
      });
      if (!res.ok) throw new Error("Failed to save measurement");
      await loadMeasurements();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save measurement");
    } finally {
      setSavingMeasurement(null);
    }
  };

  // Separate evidence by type
  const notes = evidence.filter((e) => e.type === "NOTE");
  const photos = evidence.filter((e) => e.type === "PHOTO");

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
                <Link href={`/tech/work-orders/${task.workOrderId}`} className="tech-wo-link">
                  WO: {task.workOrder.workOrderNumber || task.workOrder.title}
                </Link>
              )}
            </div>
          </div>

          {/* Timer Display */}
          {isTimerForThisTask && (
            <div className="tech-card timer-card">
              <div className="timer-display">
                <span className="timer-time">{formatTime(displaySeconds)}</span>
                <span className="timer-label">{isRunning ? "⏱ Timer Running" : "⏸ Timer Paused"}</span>
              </div>
            </div>
          )}

          {/* Task Actions */}
          <div className="tech-card">
            <h3>Actions</h3>
            <div className="status-grid">
              {task.status === "TODO" && (
                <button className="tech-btn primary large" onClick={startTask} disabled={actionLoading}>▶ Start Task</button>
              )}
              {task.status === "IN_PROGRESS" && (
                <>
                  <button className="tech-btn success large" onClick={completeTask} disabled={actionLoading}>✓ Complete Task</button>
                  <button className="tech-btn warning" onClick={pauseTask} disabled={actionLoading}>⏸ Blocked / Pause</button>
                </>
              )}
              {task.status === "BLOCKED" && (
                <>
                  <button className="tech-btn primary large" onClick={resumeTask} disabled={actionLoading}>▶ Resume Task</button>
                  <button className="tech-btn success" onClick={completeTask} disabled={actionLoading}>✓ Complete Task</button>
                </>
              )}
              {task.status === "DONE" && (
                <div className="tech-complete">
                  <span style={{ fontSize: "24px" }}>✓</span>
                  <span>Task Completed</span>
                  {timer && timer.taskInstanceId === taskId && (
                    <span style={{ fontSize: "14px", color: "var(--muted)" }}>
                      Time logged: {formatTime(timer.accumulatedSeconds || displaySeconds)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Measurements Section */}
          {measurements.length > 0 && (
            <div className="tech-card measurements-section">
              <h3>Measurements ({measurements.length})</h3>
              {measurements.map((m) => (
                <div key={m.id} className="measurement-capture">
                  <div className="measurement-capture-header">
                    <span className="measurement-capture-name">{m.name}</span>
                    {m.unit && <span className="measurement-capture-unit">{m.unit}</span>}
                  </div>
                  
                  {m.measurementType === "NUMERIC" && (m.minValue !== null || m.maxValue !== null) && (
                    <div className="measurement-capture-range">
                      Acceptable range: {m.minValue ?? "—"} to {m.maxValue ?? "—"} {m.unit || ""}
                    </div>
                  )}

                  {/* NUMERIC input */}
                  {m.measurementType === "NUMERIC" && (
                    <>
                      <input
                        type="number"
                        placeholder="Enter value..."
                        defaultValue={m.numericValue ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null;
                          if (val !== m.numericValue) {
                            saveMeasurement(m, { numericValue: val });
                          }
                        }}
                        disabled={savingMeasurement === m.id}
                      />
                      {m.numericValue !== null && m.isWithinSpec !== null && (
                        <div className={`measurement-status ${m.isWithinSpec ? "in-spec" : "out-of-spec"}`}>
                          {m.isWithinSpec ? "✓ Within spec" : "⚠ Out of spec"}
                        </div>
                      )}
                    </>
                  )}

                  {/* PASS_FAIL toggle */}
                  {m.measurementType === "PASS_FAIL" && (
                    <div className="measurement-capture-toggle">
                      <button
                        className={`pass ${m.passFail === true ? "selected" : ""}`}
                        onClick={() => saveMeasurement(m, { passFail: true })}
                        disabled={savingMeasurement === m.id}
                      >
                        ✓ Pass
                      </button>
                      <button
                        className={`fail ${m.passFail === false ? "selected" : ""}`}
                        onClick={() => saveMeasurement(m, { passFail: false })}
                        disabled={savingMeasurement === m.id}
                      >
                        ✗ Fail
                      </button>
                    </div>
                  )}

                  {/* TEXT input */}
                  {m.measurementType === "TEXT" && (
                    <input
                      type="text"
                      placeholder="Enter value..."
                      defaultValue={m.textValue ?? ""}
                      onBlur={(e) => {
                        const val = e.target.value || null;
                        if (val !== m.textValue) {
                          saveMeasurement(m, { textValue: val });
                        }
                      }}
                      disabled={savingMeasurement === m.id}
                    />
                  )}

                  {m.capturedAt && m.capturedByUser && (
                    <div className="measurement-captured-by">
                      Recorded by {m.capturedByUser.name || m.capturedByUser.email} • {formatDateTime(m.capturedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Note */}
          <div className="tech-card">
            <h3>Add Note</h3>
            <textarea
              className="tech-textarea"
              placeholder="Add a note about this task..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
            />
            <button className="tech-btn primary" onClick={addNote} disabled={noteSaving || !noteText.trim()}>
              {noteSaving ? "Saving…" : "Save Note"}
            </button>
            {noteSuccess && <span className="note-success">✓ Saved</span>}
          </div>

          {/* Display Notes */}
          {notes.length > 0 && (
            <div className="tech-card">
              <h3>Notes ({notes.length})</h3>
              <div className="evidence-list">
                {notes.map((note) => (
                  <div key={note.id} className="evidence-item note-item">
                    <div className="evidence-content">{note.noteText}</div>
                    <div className="evidence-meta">
                      {note.createdByUser.name || note.createdByUser.email} • {formatDateTime(note.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Display Photos */}
          {photos.length > 0 && (
            <div className="tech-card">
              <h3>Photos ({photos.length})</h3>
              <div className="photo-grid">
                {photos.map((photo) => (
                  <div key={photo.id} className="photo-item">
                    <a href={photo.url || "#"} target="_blank" rel="noopener noreferrer">
                      <img src={photo.url || ""} alt="Task photo" />
                    </a>
                    <div className="evidence-meta">{formatDateTime(photo.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Panel */}
          <div className="tech-card">
            <h3>Add Photos & Files</h3>
            <AttachmentsPanel entityType="task" entityId={task.id} />
          </div>
        </>
      )}
    </div>
  );
}
