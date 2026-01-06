"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type MeasurementDef = {
  id: string;
  name: string;
  unit: string | null;
  measurementType: "NUMERIC" | "PASS_FAIL" | "TEXT";
  minValue: number | null;
  maxValue: number | null;
  isRequired: boolean;
  sortOrder: number;
};

type PackTask = {
  id: string;
  title: string;
  description: string | null;
  packageType: string;
  sequenceNumber: number;
  isCritical: boolean;
  requiresEvidence: boolean;
  estimatedMinutes: number | null;
  measurementDefinitions?: MeasurementDef[];
};

type StandardsPack = {
  id: string;
  name: string;
  description: string | null;
  equipmentType: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  estimatedHours: number | null;
  tasks: PackTask[];
};

const PACKAGE_TYPES = [
  { value: "MECH_ELEC_UNIFIED", label: "Unified (Mech/Elec)" },
  { value: "MECHANICAL", label: "Mechanical" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "CONTROLS", label: "Controls" },
  { value: "INSTRUMENTATION", label: "Instrumentation" },
];

const MEASUREMENT_TYPES = [
  { value: "NUMERIC", label: "Numeric (with range)" },
  { value: "PASS_FAIL", label: "Pass/Fail" },
  { value: "TEXT", label: "Text Entry" },
];

export default function StandardsPackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const packId = params?.id as string;

  const [pack, setPack] = useState<StandardsPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit pack state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editEquipType, setEditEquipType] = useState("");
  const [editStatus, setEditStatus] = useState<string>("DRAFT");
  const [editHours, setEditHours] = useState("");

  // Add task modal
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskType, setTaskType] = useState("MECH_ELEC_UNIFIED");
  const [taskCritical, setTaskCritical] = useState(false);
  const [taskEvidence, setTaskEvidence] = useState(false);
  const [taskMinutes, setTaskMinutes] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<PackTask | null>(null);

  // Measurements modal
  const [measurementsTask, setMeasurementsTask] = useState<PackTask | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementDef[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [measName, setMeasName] = useState("");
  const [measUnit, setMeasUnit] = useState("");
  const [measType, setMeasType] = useState<string>("NUMERIC");
  const [measMin, setMeasMin] = useState("");
  const [measMax, setMeasMax] = useState("");
  const [measRequired, setMeasRequired] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);

  const loadPack = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/standards-packs/${packId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load pack");
      const json = await res.json();
      const data = json.data as StandardsPack;
      setPack(data);
      setEditName(data.name);
      setEditDesc(data.description ?? "");
      setEditEquipType(data.equipmentType ?? "");
      setEditStatus(data.status);
      setEditHours(data.estimatedHours?.toString() ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (packId) loadPack();
  }, [packId]);

  const savePack = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          equipmentType: editEquipType.trim() || null,
          status: editStatus,
          estimatedHours: editHours ? parseFloat(editHours) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await loadPack();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deletePack = async () => {
    if (!confirm("Delete this pack? This cannot be undone.")) return;
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/standards-packs");
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    }
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDesc("");
    setTaskType("MECH_ELEC_UNIFIED");
    setTaskCritical(false);
    setTaskEvidence(false);
    setTaskMinutes("");
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim() || null,
          packageType: taskType,
          isCritical: taskCritical,
          requiresEvidence: taskEvidence,
          estimatedMinutes: taskMinutes ? parseInt(taskMinutes) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      setShowAddTask(false);
      resetTaskForm();
      await loadPack();
    } catch (e: any) {
      setError(e?.message ?? "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  const updateTask = async () => {
    if (!editingTask) return;
    setAddingTask(true);
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim() || null,
          packageType: taskType,
          isCritical: taskCritical,
          requiresEvidence: taskEvidence,
          estimatedMinutes: taskMinutes ? parseInt(taskMinutes) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      setEditingTask(null);
      resetTaskForm();
      await loadPack();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update task");
    } finally {
      setAddingTask(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      await loadPack();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete task");
    }
  };

  const openEditTask = (task: PackTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description ?? "");
    setTaskType(task.packageType);
    setTaskCritical(task.isCritical);
    setTaskEvidence(task.requiresEvidence);
    setTaskMinutes(task.estimatedMinutes?.toString() ?? "");
  };

  // Measurements functions
  const openMeasurements = async (task: PackTask) => {
    setMeasurementsTask(task);
    setLoadingMeasurements(true);
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}/tasks/${task.id}/measurements`);
      if (!res.ok) throw new Error("Failed to load measurements");
      const json = await res.json();
      setMeasurements(json.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load measurements");
    } finally {
      setLoadingMeasurements(false);
    }
  };

  const closeMeasurements = () => {
    setMeasurementsTask(null);
    setMeasurements([]);
    setShowAddMeasurement(false);
    resetMeasurementForm();
  };

  const resetMeasurementForm = () => {
    setMeasName("");
    setMeasUnit("");
    setMeasType("NUMERIC");
    setMeasMin("");
    setMeasMax("");
    setMeasRequired(false);
  };

  const addMeasurement = async () => {
    if (!measName.trim() || !measurementsTask) return;
    setSavingMeasurement(true);
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}/tasks/${measurementsTask.id}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: measName.trim(),
          unit: measUnit.trim() || null,
          measurementType: measType,
          minValue: measMin ? parseFloat(measMin) : null,
          maxValue: measMax ? parseFloat(measMax) : null,
          isRequired: measRequired,
        }),
      });
      if (!res.ok) throw new Error("Failed to add measurement");
      setShowAddMeasurement(false);
      resetMeasurementForm();
      await openMeasurements(measurementsTask);
    } catch (e: any) {
      setError(e?.message ?? "Failed to add measurement");
    } finally {
      setSavingMeasurement(false);
    }
  };

  const deleteMeasurement = async (measId: string) => {
    if (!measurementsTask || !confirm("Delete this measurement?")) return;
    try {
      const res = await apiFetch(`/api/standards-packs/${packId}/tasks/${measurementsTask.id}/measurements/${measId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete measurement");
      await openMeasurements(measurementsTask);
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete measurement");
    }
  };

  // Group tasks by package type
  const tasksByType: Record<string, PackTask[]> = {};
  pack?.tasks.forEach((t) => {
    if (!tasksByType[t.packageType]) tasksByType[t.packageType] = [];
    tasksByType[t.packageType].push(t);
  });

  if (loading) return <div className="page-container"><p>Loading...</p></div>;
  if (!pack) return <div className="page-container"><p>Pack not found.</p></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link href="/standards-packs" className="back-link">← Standards Packs</Link>
          <h1>{pack.name}</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-danger" onClick={deletePack}>Delete</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Pack Details */}
      <div className="card">
        <h2>Pack Details</h2>
        <div className="form-grid">
          <div className="form-field">
            <label>Name *</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Equipment Type</label>
            <input type="text" value={editEquipType} onChange={(e) => setEditEquipType(e.target.value)} placeholder="e.g., Centrifugal Pump" />
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="form-field">
            <label>Estimated Hours</label>
            <input type="number" step="0.5" value={editHours} onChange={(e) => setEditHours(e.target.value)} placeholder="e.g., 8" />
          </div>
          <div className="form-field full-width">
            <label>Description</label>
            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={savePack} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="card">
        <div className="card-header-row">
          <h2>Tasks ({pack.tasks.length})</h2>
          <button className="btn btn-primary" onClick={() => setShowAddTask(true)}>+ Add Task</button>
        </div>

        {pack.tasks.length === 0 ? (
          <p className="muted">No tasks yet. Add tasks to build your template.</p>
        ) : (
          <div className="tasks-by-type">
            {Object.entries(tasksByType).map(([type, tasks]) => (
              <div key={type} className="task-group">
                <h4 className="task-group-header">
                  {PACKAGE_TYPES.find((t) => t.value === type)?.label ?? type}
                  <span className="task-count">({tasks.length})</span>
                </h4>
                <ul className="task-list">
                  {tasks.map((task, idx) => (
                    <li key={task.id} className="task-item">
                      <div className="task-info">
                        <span className="task-number">{idx + 1}.</span>
                        <span className="task-title">{task.title}</span>
                        {task.isCritical && <span className="badge critical">Critical</span>}
                        {task.requiresEvidence && <span className="badge evidence">Evidence</span>}
                        {task.estimatedMinutes && <span className="task-time">{task.estimatedMinutes}m</span>}
                      </div>
                      <div className="task-actions">
                        <button className="btn-icon" onClick={() => openMeasurements(task)} title="Measurements">📏</button>
                        <button className="btn-icon" onClick={() => openEditTask(task)} title="Edit">✏️</button>
                        <button className="btn-icon danger" onClick={() => deleteTask(task.id)} title="Delete">🗑️</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Task Modal */}
      {(showAddTask || editingTask) && (
        <div className="modal-overlay" onClick={() => { setShowAddTask(false); setEditingTask(null); resetTaskForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingTask ? "Edit Task" : "Add Task"}</h2>
            <div className="form-field">
              <label>Task Title *</label>
              <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g., Remove coupling guard" autoFocus />
            </div>
            <div className="form-field">
              <label>Package Type</label>
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                {PACKAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Description</label>
              <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Detailed instructions..." rows={2} />
            </div>
            <div className="form-field">
              <label>Estimated Minutes</label>
              <input type="number" value={taskMinutes} onChange={(e) => setTaskMinutes(e.target.value)} placeholder="e.g., 30" />
            </div>
            <div className="form-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={taskCritical} onChange={(e) => setTaskCritical(e.target.checked)} />
                Critical Task
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={taskEvidence} onChange={(e) => setTaskEvidence(e.target.checked)} />
                Requires Evidence
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAddTask(false); setEditingTask(null); resetTaskForm(); }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingTask ? updateTask : addTask} disabled={!taskTitle.trim() || addingTask}>
                {addingTask ? "Saving..." : editingTask ? "Update Task" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurements Modal */}
      {measurementsTask && (
        <div className="modal-overlay" onClick={closeMeasurements}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Measurements: {measurementsTask.title}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>Define data points techs will capture for this task.</p>

            {loadingMeasurements ? (
              <p>Loading...</p>
            ) : (
              <>
                {measurements.length === 0 ? (
                  <p className="muted">No measurements defined yet.</p>
                ) : (
                  <ul className="measurement-list">
                    {measurements.map((m) => (
                      <li key={m.id} className="measurement-item">
                        <div className="measurement-info">
                          <strong>{m.name}</strong>
                          {m.unit && <span className="measurement-unit">({m.unit})</span>}
                          <span className={`badge ${m.measurementType.toLowerCase()}`}>{m.measurementType}</span>
                          {m.isRequired && <span className="badge required">Required</span>}
                          {m.measurementType === "NUMERIC" && (m.minValue !== null || m.maxValue !== null) && (
                            <span className="measurement-range">
                              Range: {m.minValue ?? "—"} to {m.maxValue ?? "—"}
                            </span>
                          )}
                        </div>
                        <button className="btn-icon danger" onClick={() => deleteMeasurement(m.id)}>🗑️</button>
                      </li>
                    ))}
                  </ul>
                )}

                {!showAddMeasurement ? (
                  <button className="btn btn-primary" onClick={() => setShowAddMeasurement(true)} style={{ marginTop: 16 }}>
                    + Add Measurement
                  </button>
                ) : (
                  <div className="add-measurement-form">
                    <h4>New Measurement</h4>
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Name *</label>
                        <input type="text" value={measName} onChange={(e) => setMeasName(e.target.value)} placeholder="e.g., Bearing Temperature" />
                      </div>
                      <div className="form-field">
                        <label>Unit</label>
                        <input type="text" value={measUnit} onChange={(e) => setMeasUnit(e.target.value)} placeholder="e.g., °F, mils, psi" />
                      </div>
                      <div className="form-field">
                        <label>Type</label>
                        <select value={measType} onChange={(e) => setMeasType(e.target.value)}>
                          {MEASUREMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      {measType === "NUMERIC" && (
                        <>
                          <div className="form-field">
                            <label>Min Value</label>
                            <input type="number" value={measMin} onChange={(e) => setMeasMin(e.target.value)} placeholder="e.g., 100" />
                          </div>
                          <div className="form-field">
                            <label>Max Value</label>
                            <input type="number" value={measMax} onChange={(e) => setMeasMax(e.target.value)} placeholder="e.g., 180" />
                          </div>
                        </>
                      )}
                      <div className="form-field">
                        <label className="checkbox-label">
                          <input type="checkbox" checked={measRequired} onChange={(e) => setMeasRequired(e.target.checked)} />
                          Required
                        </label>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn btn-secondary" onClick={() => { setShowAddMeasurement(false); resetMeasurementForm(); }}>Cancel</button>
                      <button className="btn btn-primary" onClick={addMeasurement} disabled={!measName.trim() || savingMeasurement}>
                        {savingMeasurement ? "Adding..." : "Add Measurement"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="modal-actions" style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <button className="btn btn-secondary" onClick={closeMeasurements}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
