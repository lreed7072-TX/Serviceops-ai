"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import "../standards-detail.css";

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

  if (loading) return <div className="standards-detail-page"><p className="sd-loading">Loading...</p></div>;
  if (!pack) return <div className="standards-detail-page"><p className="sd-empty">Pack not found.</p></div>;

  return (
    <div className="standards-detail-page">
      <Breadcrumbs items={[
        { label: "Standards Packs", href: "/standards-packs" },
        { label: pack.name },
      ]} />

      <div className="sd-page-header">
        <div className="sd-page-header-left">
          <h1>{pack.name}</h1>
        </div>
        <div className="sd-header-actions">
          <button className="sd-btn-danger" onClick={deletePack}>Delete</button>
        </div>
      </div>

      {error && <div className="sd-alert-error">{error}</div>}

      {/* Pack Details */}
      <div className="sd-detail-card">
        <div className="sd-card-header">
          <h2>Pack Details</h2>
        </div>
        <div className="sd-card-body">
          <div className="sd-form-grid">
            <div className="sd-form-field">
              <label className="sd-form-label">Name *</label>
              <input className="sd-form-input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="sd-form-field">
              <label className="sd-form-label">Equipment Type</label>
              <input className="sd-form-input" type="text" value={editEquipType} onChange={(e) => setEditEquipType(e.target.value)} placeholder="e.g., Centrifugal Pump" />
            </div>
            <div className="sd-form-field">
              <label className="sd-form-label">Status</label>
              <select className="sd-form-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="sd-form-field">
              <label className="sd-form-label">Estimated Hours</label>
              <input className="sd-form-input" type="number" step="0.5" value={editHours} onChange={(e) => setEditHours(e.target.value)} placeholder="e.g., 8" />
            </div>
            <div className="sd-form-field full-width">
              <label className="sd-form-label">Description</label>
              <textarea className="sd-form-textarea" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="sd-form-actions">
            <button className="sd-btn-primary" onClick={savePack} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="sd-tasks-card">
        <div className="sd-tasks-header">
          <h2>Tasks ({pack.tasks.length})</h2>
          <button className="sd-btn-primary" onClick={() => setShowAddTask(true)}>+ Add Task</button>
        </div>

        <div className="sd-tasks-body">
          {pack.tasks.length === 0 ? (
            <p className="sd-empty">No tasks yet. Add tasks to build your template.</p>
          ) : (
            <div>
              {Object.entries(tasksByType).map(([type, tasks]) => (
                <div key={type} className="sd-task-group">
                  <h4 className="sd-task-group-header">
                    {PACKAGE_TYPES.find((t) => t.value === type)?.label ?? type}
                    <span className="sd-task-count">({tasks.length})</span>
                  </h4>
                  <ul className="sd-task-list">
                    {tasks.map((task, idx) => (
                      <li key={task.id} className="sd-task-item">
                        <div className="sd-task-info">
                          <span className="sd-task-number">{idx + 1}.</span>
                          <span className="sd-task-title">{task.title}</span>
                          {task.isCritical && <span className="sd-task-badge critical">Critical</span>}
                          {task.requiresEvidence && <span className="sd-task-badge evidence">Evidence</span>}
                          {task.estimatedMinutes && <span className="sd-task-time">{task.estimatedMinutes}m</span>}
                        </div>
                        <div className="sd-task-actions">
                          <button className="sd-btn-icon" onClick={() => openMeasurements(task)} title="Measurements">📏</button>
                          <button className="sd-btn-icon" onClick={() => openEditTask(task)} title="Edit">✏️</button>
                          <button className="sd-btn-icon danger" onClick={() => deleteTask(task.id)} title="Delete">🗑️</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Task Modal */}
      {(showAddTask || editingTask) && (
        <div className="sd-modal-overlay" onClick={() => { setShowAddTask(false); setEditingTask(null); resetTaskForm(); }}>
          <div className="sd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sd-modal-header">
              <h2>{editingTask ? "Edit Task" : "Add Task"}</h2>
            </div>
            <div className="sd-modal-body">
              <div className="sd-form-field">
                <label className="sd-form-label">Task Title *</label>
                <input className="sd-form-input" type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g., Remove coupling guard" autoFocus />
              </div>
              <div className="sd-form-field">
                <label className="sd-form-label">Package Type</label>
                <select className="sd-form-select" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                  {PACKAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="sd-form-field">
                <label className="sd-form-label">Description</label>
                <textarea className="sd-form-textarea" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Detailed instructions..." rows={2} />
              </div>
              <div className="sd-form-field">
                <label className="sd-form-label">Estimated Minutes</label>
                <input className="sd-form-input" type="number" value={taskMinutes} onChange={(e) => setTaskMinutes(e.target.value)} placeholder="e.g., 30" />
              </div>
              <div className="sd-checkbox-row">
                <label className="sd-checkbox-label">
                  <input type="checkbox" checked={taskCritical} onChange={(e) => setTaskCritical(e.target.checked)} />
                  Critical Task
                </label>
                <label className="sd-checkbox-label">
                  <input type="checkbox" checked={taskEvidence} onChange={(e) => setTaskEvidence(e.target.checked)} />
                  Requires Evidence
                </label>
              </div>
            </div>
            <div className="sd-modal-footer">
              <button className="sd-btn-cancel" onClick={() => { setShowAddTask(false); setEditingTask(null); resetTaskForm(); }}>Cancel</button>
              <button className="sd-btn-primary" onClick={editingTask ? updateTask : addTask} disabled={!taskTitle.trim() || addingTask}>
                {addingTask ? "Saving..." : editingTask ? "Update Task" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measurements Modal */}
      {measurementsTask && (
        <div className="sd-modal-overlay" onClick={closeMeasurements}>
          <div className="sd-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="sd-modal-header">
              <h2>Measurements: {measurementsTask.title}</h2>
            </div>
            <div className="sd-modal-body">
              <p className="sd-modal-note">Define data points techs will capture for this task.</p>

              {loadingMeasurements ? (
                <p className="sd-loading">Loading...</p>
              ) : (
                <>
                  {measurements.length === 0 ? (
                    <p className="sd-empty">No measurements defined yet.</p>
                  ) : (
                    <ul className="sd-measurement-list">
                      {measurements.map((m) => (
                        <li key={m.id} className="sd-measurement-item">
                          <div className="sd-measurement-info">
                            <strong>{m.name}</strong>
                            {m.unit && <span className="sd-measurement-unit">({m.unit})</span>}
                            <span className={`sd-meas-badge ${m.measurementType.toLowerCase()}`}>{m.measurementType}</span>
                            {m.isRequired && <span className="sd-meas-badge required">Required</span>}
                            {m.measurementType === "NUMERIC" && (m.minValue !== null || m.maxValue !== null) && (
                              <span className="sd-measurement-range">
                                Range: {m.minValue ?? "\u2014"} to {m.maxValue ?? "\u2014"}
                              </span>
                            )}
                          </div>
                          <button className="sd-btn-icon danger" onClick={() => deleteMeasurement(m.id)}>🗑️</button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!showAddMeasurement ? (
                    <button className="sd-btn-primary" onClick={() => setShowAddMeasurement(true)} style={{ marginTop: "1rem" }}>
                      + Add Measurement
                    </button>
                  ) : (
                    <div className="sd-add-measurement-form">
                      <h4>New Measurement</h4>
                      <div className="sd-meas-form-grid">
                        <div className="sd-form-field">
                          <label className="sd-form-label">Name *</label>
                          <input className="sd-form-input" type="text" value={measName} onChange={(e) => setMeasName(e.target.value)} placeholder="e.g., Bearing Temperature" />
                        </div>
                        <div className="sd-form-field">
                          <label className="sd-form-label">Unit</label>
                          <input className="sd-form-input" type="text" value={measUnit} onChange={(e) => setMeasUnit(e.target.value)} placeholder="e.g., deg F, mils, psi" />
                        </div>
                        <div className="sd-form-field">
                          <label className="sd-form-label">Type</label>
                          <select className="sd-form-select" value={measType} onChange={(e) => setMeasType(e.target.value)}>
                            {MEASUREMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        {measType === "NUMERIC" && (
                          <>
                            <div className="sd-form-field">
                              <label className="sd-form-label">Min Value</label>
                              <input className="sd-form-input" type="number" value={measMin} onChange={(e) => setMeasMin(e.target.value)} placeholder="e.g., 100" />
                            </div>
                            <div className="sd-form-field">
                              <label className="sd-form-label">Max Value</label>
                              <input className="sd-form-input" type="number" value={measMax} onChange={(e) => setMeasMax(e.target.value)} placeholder="e.g., 180" />
                            </div>
                          </>
                        )}
                        <div className="sd-form-field">
                          <label className="sd-checkbox-label">
                            <input type="checkbox" checked={measRequired} onChange={(e) => setMeasRequired(e.target.checked)} />
                            Required
                          </label>
                        </div>
                      </div>
                      <div className="sd-meas-form-actions">
                        <button className="sd-btn-cancel" onClick={() => { setShowAddMeasurement(false); resetMeasurementForm(); }}>Cancel</button>
                        <button className="sd-btn-primary" onClick={addMeasurement} disabled={!measName.trim() || savingMeasurement}>
                          {savingMeasurement ? "Adding..." : "Add Measurement"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="sd-modal-footer">
              <button className="sd-btn-secondary" onClick={closeMeasurements}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
