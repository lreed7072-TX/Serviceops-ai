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

type MaterialUsage = {
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

type CatalogMaterial = {
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
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function TechTaskPage() {
  const params = useParams();
  const taskId = params?.id as string | undefined;

  const [task, setTask] = useState<TaskData | null>(null);
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [evidence, setEvidence] = useState<EvidenceData[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
  const [materials, setMaterials] = useState<MaterialUsage[]>([]);
  const [catalog, setCatalog] = useState<CatalogMaterial[]>([]);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState<string | null>(null);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [matQty, setMatQty] = useState("1");
  const [matNotes, setMatNotes] = useState("");
  const [savingMaterial, setSavingMaterial] = useState(false);

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.text()) || "Failed to load task");
      setTask((await res.json()).data);
    } catch (e: any) { setErr(e?.message ?? "Failed to load task"); }
  }, [taskId]);

  const loadTimer = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tech/timer", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()).data;
      setTimer(data);
      if (data) setDisplaySeconds(data.currentSeconds);
    } catch (e) { console.error(e); }
  }, []);

  const loadEvidence = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/evidence`, { cache: "no-store" });
      if (res.ok) setEvidence((await res.json()).data ?? []);
    } catch (e) { console.error(e); }
  }, [taskId]);

  const loadMeasurements = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/measurements`, { cache: "no-store" });
      if (res.ok) setMeasurements((await res.json()).data ?? []);
    } catch (e) { console.error(e); }
  }, [taskId]);

  const loadMaterials = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/materials`, { cache: "no-store" });
      if (res.ok) setMaterials((await res.json()).data ?? []);
    } catch (e) { console.error(e); }
  }, [taskId]);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await apiFetch("/api/materials?active=true", { cache: "no-store" });
      if (res.ok) setCatalog((await res.json()).data ?? []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTask(), loadTimer(), loadEvidence(), loadMeasurements(), loadMaterials(), loadCatalog()])
      .finally(() => setLoading(false));
  }, [loadTask, loadTimer, loadEvidence, loadMeasurements, loadMaterials, loadCatalog]);

  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;
    const interval = setInterval(() => setDisplaySeconds((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const isTimerForThisTask = timer && timer.taskInstanceId === taskId && timer.status !== "STOPPED";
  const isRunning = timer?.status === "RUNNING" && isTimerForThisTask;
  const isPaused = timer?.status === "PAUSED" && isTimerForThisTask;

  const startTimer = async () => {
    if (!task) return;
    const res = await apiFetch("/api/tech/timer/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workOrderId: task.workOrderId, taskInstanceId: task.id }),
    });
    if (!res.ok) throw new Error((await res.text()) || "Failed to start timer");
    await loadTimer();
  };

  const pauseTimer = async () => {
    const res = await apiFetch("/api/tech/timer/pause", { method: "POST" });
    if (!res.ok) throw new Error("Failed to pause");
    await loadTimer();
  };

  const resumeTimer = async () => {
    const res = await apiFetch("/api/tech/timer/resume", { method: "POST" });
    if (!res.ok) throw new Error("Failed to resume");
    await loadTimer();
  };

  const stopTimer = async () => {
    const res = await apiFetch("/api/tech/timer/stop", { method: "POST" });
    if (!res.ok) throw new Error("Failed to stop");
    await loadTimer();
  };

  const startTask = async () => {
    if (!taskId || !task) return;
    setActionLoading(true); setErr(null);
    try {
      await startTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (!res.ok) throw new Error("Failed to start");
      await loadTask();
    } catch (e: any) { setErr(e?.message); } finally { setActionLoading(false); }
  };

  const pauseTask = async () => {
    if (!taskId) return;
    setActionLoading(true); setErr(null);
    try {
      if (isRunning) await pauseTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "BLOCKED" }),
      });
      if (!res.ok) throw new Error("Failed to pause");
      await loadTask();
    } catch (e: any) { setErr(e?.message); } finally { setActionLoading(false); }
  };

  const resumeTask = async () => {
    if (!taskId || !task) return;
    setActionLoading(true); setErr(null);
    try {
      if (isPaused) await resumeTimer();
      else if (!isTimerForThisTask) await startTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (!res.ok) throw new Error("Failed to resume");
      await loadTask();
    } catch (e: any) { setErr(e?.message); } finally { setActionLoading(false); }
  };

  const completeTask = async () => {
    if (!taskId) return;
    setActionLoading(true); setErr(null);
    try {
      if (isTimerForThisTask) await stopTimer();
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (!res.ok) throw new Error("Failed to complete");
      await loadTask();
    } catch (e: any) { setErr(e?.message); } finally { setActionLoading(false); }
  };

  const addNote = async () => {
    if (!taskId || !noteText.trim()) return;
    setNoteSaving(true); setNoteSuccess(false);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/evidence`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "NOTE", noteText: noteText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteText(""); setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 2000);
      await loadEvidence();
    } catch (e: any) { setErr(e?.message); } finally { setNoteSaving(false); }
  };

  const saveMeasurement = async (m: MeasurementData, value: any) => {
    if (!taskId) return;
    setSavingMeasurement(m.id);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/measurements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measurementId: m.id, ...value }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await loadMeasurements();
    } catch (e: any) { setErr(e?.message); } finally { setSavingMeasurement(null); }
  };

  const addMaterial = async () => {
    if (!taskId || !selectedMaterial) return;
    const mat = catalog.find((c) => c.id === selectedMaterial);
    if (!mat) return;
    setSavingMaterial(true);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/materials`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: mat.id, name: mat.name, partNumber: mat.partNumber,
          quantity: parseFloat(matQty) || 1, unitCost: mat.unitCost, unit: mat.unit,
          notes: matNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      setShowAddMaterial(false); setSelectedMaterial(""); setMatQty("1"); setMatNotes("");
      await loadMaterials();
    } catch (e: any) { setErr(e?.message); } finally { setSavingMaterial(false); }
  };

  const deleteMaterial = async (id: string) => {
    if (!taskId || !confirm("Remove this material?")) return;
    try {
      await apiFetch(`/api/tasks/${taskId}/materials/${id}`, { method: "DELETE" });
      await loadMaterials();
    } catch (e: any) { setErr(e?.message); }
  };

  const notes = evidence.filter((e) => e.type === "NOTE");
  const photos = evidence.filter((e) => e.type === "PHOTO");

  if (!taskId) return <div className="tech-container"><p>Missing task ID.</p></div>;

  return (
    <div className="tech-container">
      <div className="tech-header">
        <Link href="/tech" className="tech-back">← Back</Link>
        <h1>Task</h1>
      </div>

      {err && <div className="tech-alert error">{err}</div>}
      {loading && <div className="tech-alert info">Loading…</div>}

      {task && (
        <>
          <div className="tech-card">
            <div className="tech-card-header">
              <h2>{task.title}</h2>
              {task.isCritical && <span className="tech-badge critical">Critical</span>}
            </div>
            {task.description && <p className="tech-description">{task.description}</p>}
            <div className="tech-meta">
              <span className={`tech-status ${task.status.toLowerCase()}`}>{task.status.replace("_", " ")}</span>
              {task.workOrder && (
                <Link href={`/tech/work-orders/${task.workOrderId}`} className="tech-wo-link">
                  WO: {task.workOrder.workOrderNumber || task.workOrder.title}
                </Link>
              )}
            </div>
          </div>

          {isTimerForThisTask && (
            <div className="tech-card timer-card">
              <div className="timer-display">
                <span className="timer-time">{formatTime(displaySeconds)}</span>
                <span className="timer-label">{isRunning ? "⏱ Timer Running" : "⏸ Timer Paused"}</span>
              </div>
            </div>
          )}

          <div className="tech-card">
            <h3>Actions</h3>
            <div className="status-grid">
              {task.status === "TODO" && <button className="tech-btn primary large" onClick={startTask} disabled={actionLoading}>▶ Start Task</button>}
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
                </div>
              )}
            </div>
          </div>

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
                    <div className="measurement-capture-range">Range: {m.minValue ?? "—"} to {m.maxValue ?? "—"}</div>
                  )}
                  {m.measurementType === "NUMERIC" && (
                    <>
                      <input type="number" placeholder="Enter value..." defaultValue={m.numericValue ?? ""}
                        onBlur={(e) => { const v = e.target.value ? parseFloat(e.target.value) : null; if (v !== m.numericValue) saveMeasurement(m, { numericValue: v }); }}
                        disabled={savingMeasurement === m.id} />
                      {m.numericValue !== null && m.isWithinSpec !== null && (
                        <div className={`measurement-status ${m.isWithinSpec ? "in-spec" : "out-of-spec"}`}>
                          {m.isWithinSpec ? "✓ Within spec" : "⚠ Out of spec"}
                        </div>
                      )}
                    </>
                  )}
                  {m.measurementType === "PASS_FAIL" && (
                    <div className="measurement-capture-toggle">
                      <button className={`pass ${m.passFail === true ? "selected" : ""}`} onClick={() => saveMeasurement(m, { passFail: true })} disabled={savingMeasurement === m.id}>✓ Pass</button>
                      <button className={`fail ${m.passFail === false ? "selected" : ""}`} onClick={() => saveMeasurement(m, { passFail: false })} disabled={savingMeasurement === m.id}>✗ Fail</button>
                    </div>
                  )}
                  {m.measurementType === "TEXT" && (
                    <input type="text" placeholder="Enter value..." defaultValue={m.textValue ?? ""}
                      onBlur={(e) => { const v = e.target.value || null; if (v !== m.textValue) saveMeasurement(m, { textValue: v }); }}
                      disabled={savingMeasurement === m.id} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="tech-card">
            <div className="tech-card-header">
              <h3>Materials Used</h3>
              <button className="tech-btn small" onClick={() => setShowAddMaterial(true)}>+ Add</button>
            </div>
            {materials.length === 0 ? <p className="muted">No materials recorded yet.</p> : (
              <div className="materials-list">
                {materials.map((m) => (
                  <div key={m.id} className="material-item">
                    <div className="material-info">
                      <strong>{m.name}</strong>
                      {m.partNumber && <span className="material-part">#{m.partNumber}</span>}
                      <span className="material-qty">{m.quantity} {m.unit || "ea"}</span>
                      {m.totalCost && <span className="material-cost">${m.totalCost.toFixed(2)}</span>}
                    </div>
                    <button className="btn-icon danger" onClick={() => deleteMaterial(m.id)}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAddMaterial && (
            <div className="modal-overlay" onClick={() => setShowAddMaterial(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Add Material</h2>
                <div className="form-field">
                  <label>Select Material</label>
                  <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)}>
                    <option value="">-- Select --</option>
                    {catalog.map((c) => <option key={c.id} value={c.id}>{c.name} {c.partNumber ? `(#${c.partNumber})` : ""}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Quantity</label>
                  <input type="number" value={matQty} onChange={(e) => setMatQty(e.target.value)} min="1" />
                </div>
                <div className="form-field">
                  <label>Notes (optional)</label>
                  <input type="text" value={matNotes} onChange={(e) => setMatNotes(e.target.value)} placeholder="S/N, condition, etc." />
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowAddMaterial(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={addMaterial} disabled={!selectedMaterial || savingMaterial}>{savingMaterial ? "Adding..." : "Add Material"}</button>
                </div>
              </div>
            </div>
          )}

          <div className="tech-card">
            <h3>Add Note</h3>
            <textarea className="tech-textarea" placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} />
            <button className="tech-btn primary" onClick={addNote} disabled={noteSaving || !noteText.trim()}>{noteSaving ? "Saving…" : "Save Note"}</button>
            {noteSuccess && <span className="note-success">✓ Saved</span>}
          </div>

          {notes.length > 0 && (
            <div className="tech-card">
              <h3>Notes ({notes.length})</h3>
              <div className="evidence-list">
                {notes.map((n) => (
                  <div key={n.id} className="evidence-item note-item">
                    <div className="evidence-content">{n.noteText}</div>
                    <div className="evidence-meta">{n.createdByUser.name || n.createdByUser.email} • {formatDateTime(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {photos.length > 0 && (
            <div className="tech-card">
              <h3>Photos ({photos.length})</h3>
              <div className="photo-grid">
                {photos.map((p) => (
                  <div key={p.id} className="photo-item">
                    <a href={p.url || "#"} target="_blank" rel="noopener noreferrer"><img src={p.url || ""} alt="Photo" /></a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="tech-card">
            <h3>Add Photos & Files</h3>
            <AttachmentsPanel entityType="task" entityId={task.id} />
          </div>
        </>
      )}
    </div>
  );
}
