"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import EvidenceCapture from "./EvidenceCapture";
import MeasurementEntry from "./MeasurementEntry";
import "./TaskList.css";

type CatalogMaterial = {
  id: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  unitCost: number | null;
  unit: string | null;
};

type TaskMeasurement = {
  id: string;
  name: string;
  measurementType: "NUMERIC" | "TEXT" | "PASS_FAIL";
  numericValue: number | null;
  textValue: string | null;
  passFail: boolean | null;
  unit: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  isWithinSpec: boolean | null;
  capturedAt: string | null;
  capturedByUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type TaskMaterialUsage = {
  id: string;
  name: string;
  partNumber: string | null;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
};

type TaskData = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "SKIPPED";
  sequenceNumber: number | null;
  isCritical: boolean;
  requiresEvidence: boolean;
  assignedTo: { id: string; name: string | null; email: string } | null;
  measurements: TaskMeasurement[];
  materialUsages: TaskMaterialUsage[];
  timeEntries: Array<{
    id: string;
    status: string;
    accumulatedSeconds: number;
  }>;
};

type PackageData = {
  id: string;
  name: string;
  packageType: string;
  status: string;
  leadTech: { id: string; name: string | null; email: string } | null;
  tasks: TaskData[];
};

interface TaskListProps {
  packages: PackageData[];
  workOrderId: string;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  TODO: { label: "To Do", color: "gray" },
  IN_PROGRESS: { label: "In Progress", color: "blue" },
  DONE: { label: "Done", color: "green" },
  BLOCKED: { label: "Blocked", color: "red" },
  SKIPPED: { label: "Skipped", color: "orange" },
};

const PACKAGE_TYPE_LABELS: Record<string, string> = {
  MECH_ELEC_UNIFIED: "Mech/Elec",
  MECHANICAL: "Mechanical",
  ELECTRICAL: "Electrical",
  CONTROLS: "Controls",
  INSTRUMENTATION: "Instrumentation",
};

export default function TaskList({ packages, workOrderId, onRefresh }: TaskListProps) {
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(
    new Set(packages.map((p) => p.id))
  );
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const toast = useToast();

  // Add Material modal state
  const [addMaterialTaskId, setAddMaterialTaskId] = useState<string | null>(null);
  const [matSearch, setMatSearch] = useState("");
  const [matResults, setMatResults] = useState<CatalogMaterial[]>([]);
  const [searchingMats, setSearchingMats] = useState(false);
  const [showMatDropdown, setShowMatDropdown] = useState(false);
  const [selectedMat, setSelectedMat] = useState<CatalogMaterial | null>(null);
  const [matQuantity, setMatQuantity] = useState(1);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const matSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchMaterials = useCallback(async (term: string) => {
    if (!term.trim()) {
      setMatResults([]);
      setShowMatDropdown(false);
      return;
    }
    setSearchingMats(true);
    try {
      const res = await apiFetch(`/api/materials?search=${encodeURIComponent(term)}&isActive=true&limit=10`);
      if (res.ok) {
        const result = await res.json();
        setMatResults(result.data || []);
        setShowMatDropdown(true);
      }
    } catch {
      // silently fail
    } finally {
      setSearchingMats(false);
    }
  }, []);

  const handleMatSearchChange = (value: string) => {
    setMatSearch(value);
    if (matSearchTimer.current) clearTimeout(matSearchTimer.current);
    matSearchTimer.current = setTimeout(() => searchMaterials(value), 300);
  };

  const openAddMaterial = (taskId: string) => {
    setAddMaterialTaskId(taskId);
    setSelectedMat(null);
    setMatSearch("");
    setMatResults([]);
    setShowMatDropdown(false);
    setMatQuantity(1);
  };

  const closeAddMaterial = () => {
    setAddMaterialTaskId(null);
    setSelectedMat(null);
    setMatSearch("");
    setMatResults([]);
    setShowMatDropdown(false);
    setMatQuantity(1);
  };

  const handleAddMaterial = async () => {
    if (!addMaterialTaskId || !selectedMat) return;
    setAddingMaterial(true);
    try {
      const res = await apiFetch(`/api/tasks/${addMaterialTaskId}/materials`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          materialId: selectedMat.id,
          name: selectedMat.name,
          partNumber: selectedMat.partNumber || undefined,
          quantity: matQuantity,
          unitCost: selectedMat.unitCost ?? undefined,
          unit: selectedMat.unit || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add material");
      }
      toast.success("Material added");
      closeAddMaterial();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to add material");
    } finally {
      setAddingMaterial(false);
    }
  };

  const togglePkg = (id: string) => {
    const next = new Set(expandedPkgs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedPkgs(next);
  };

  const toggleTask = (id: string) => {
    const next = new Set(expandedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTasks(next);
  };

  const changeStatus = async (taskId: string, newStatus: string) => {
    setChangingStatus(taskId);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      onRefresh();
    } catch {
      toast.error("Failed to update task status");
    } finally {
      setChangingStatus(null);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const totalTasks = packages.reduce((s, p) => s + p.tasks.length, 0);

  if (packages.length === 0 || totalTasks === 0) {
    return (
      <div className="tl-empty">
        <div className="tl-empty-icon">📋</div>
        <p>No tasks assigned to this work order yet</p>
      </div>
    );
  }

  return (
    <div className="tl-list">
      {packages.map((pkg) => {
        const done = pkg.tasks.filter((t) => t.status === "DONE").length;
        const total = pkg.tasks.length;
        if (total === 0) return null;
        const pct = Math.round((done / total) * 100);
        const isExpanded = expandedPkgs.has(pkg.id);

        return (
          <div key={pkg.id} className="tl-package">
            {/* Package Header */}
            <div className="tl-pkg-header" onClick={() => togglePkg(pkg.id)}>
              <div className="tl-pkg-left">
                <span className="tl-expand">{isExpanded ? "▼" : "▶"}</span>
                <div>
                  <h3 className="tl-pkg-name">{pkg.name}</h3>
                  <div className="tl-pkg-badges">
                    <span className={`tl-type-badge ${pkg.packageType.toLowerCase()}`}>
                      {PACKAGE_TYPE_LABELS[pkg.packageType] || pkg.packageType}
                    </span>
                    {pkg.leadTech && (
                      <span className="tl-lead-tech">
                        👤 {pkg.leadTech.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="tl-pkg-stats">
                <span className="tl-stat-text">{done}/{total}</span>
                <div className="tl-progress">
                  <div className="tl-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="tl-stat-pct">{pct}%</span>
              </div>
            </div>

            {/* Tasks */}
            {isExpanded && (
              <div className="tl-tasks">
                {pkg.tasks.map((task) => {
                  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.TODO;
                  const taskExpanded = expandedTasks.has(task.id);
                  const taskTime = task.timeEntries.reduce(
                    (s, e) => s + (e.accumulatedSeconds || 0),
                    0
                  );

                  return (
                    <div
                      key={task.id}
                      className={`tl-task ${task.isCritical ? "critical" : ""}`}
                    >
                      {/* Task Header */}
                      <div className="tl-task-header">
                        <div className="tl-task-title-row">
                          {task.sequenceNumber != null && (
                            <span className="tl-task-num">#{task.sequenceNumber}</span>
                          )}
                          <Link
                            href={`/tasks/${task.id}`}
                            className="tl-task-title"
                          >
                            {task.title}
                          </Link>
                          {task.isCritical && (
                            <span className="tl-critical">Critical</span>
                          )}
                        </div>
                        <select
                          value={task.status}
                          onChange={(e) => changeStatus(task.id, e.target.value)}
                          disabled={changingStatus === task.id}
                          className={`tl-status-select tl-status-${cfg.color}`}
                        >
                          {Object.entries(STATUS_CONFIG).map(([val, c]) => (
                            <option key={val} value={val}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {task.description && (
                        <p className="tl-task-desc">{task.description}</p>
                      )}

                      {/* Task Meta */}
                      <div className="tl-task-meta">
                        {task.assignedTo && (
                          <span className="tl-meta">
                            👤 {task.assignedTo.name}
                          </span>
                        )}
                        {task.requiresEvidence && (
                          <span className="tl-meta tl-meta-warn">
                            📷 Evidence Required
                          </span>
                        )}
                        {task.measurements.length > 0 && (
                          <span className="tl-meta tl-meta-ok">
                            📊 {task.measurements.length} Measurements
                          </span>
                        )}
                        {task.materialUsages.length > 0 && (
                          <span className="tl-meta tl-meta-ok">
                            🔧 {task.materialUsages.length} Materials
                          </span>
                        )}
                        {taskTime > 0 && (
                          <span className="tl-meta">
                            ⏱ {formatTime(taskTime)}
                          </span>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="tl-task-actions">
                        <button
                          className="btn btn-secondary tl-action-btn"
                          onClick={() => toggleTask(task.id)}
                        >
                          {taskExpanded ? "Collapse" : "Details & Evidence"}
                        </button>
                        {task.status === "TODO" && (
                          <button
                            className="btn btn-primary tl-action-btn"
                            onClick={() => changeStatus(task.id, "IN_PROGRESS")}
                            disabled={changingStatus === task.id}
                          >
                            Start Task
                          </button>
                        )}
                        {task.status === "IN_PROGRESS" && (
                          <button
                            className="btn tl-action-btn tl-btn-success"
                            onClick={() => changeStatus(task.id, "DONE")}
                            disabled={changingStatus === task.id}
                          >
                            Mark Complete
                          </button>
                        )}
                      </div>

                      {/* Expanded Detail */}
                      {taskExpanded && (
                        <div className="tl-task-detail">
                          {/* Measurements */}
                          <div className="tl-detail-section">
                            <h5>Measurements</h5>
                            <MeasurementEntry
                              taskId={task.id}
                              measurements={task.measurements}
                              onRefresh={onRefresh}
                            />
                          </div>

                          {/* Materials */}
                            <div className="tl-detail-section">
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                <h5 style={{ margin: 0 }}>Materials Used</h5>
                                <button
                                  className="btn btn-secondary tl-action-btn"
                                  onClick={() => openAddMaterial(task.id)}
                                  style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem" }}
                                >
                                  + Add Material
                                </button>
                              </div>
                              {task.materialUsages.length > 0 ? (
                                <div className="tl-materials">
                                  {task.materialUsages.map((mat) => (
                                    <div key={mat.id} className="tl-material">
                                      <span className="tl-mat-name">
                                        {mat.name}
                                        {mat.partNumber && (
                                          <span className="tl-mat-part">
                                            ({mat.partNumber})
                                          </span>
                                        )}
                                      </span>
                                      <span className="tl-mat-qty">
                                        Qty: {mat.quantity}
                                      </span>
                                      {mat.totalCost != null && (
                                        <span className="tl-mat-cost">
                                          ${mat.totalCost.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: 0 }}>No materials added yet</p>
                              )}
                            </div>

                          {/* Evidence Capture */}
                          <div className="tl-detail-section">
                            <h5>Evidence & Notes</h5>
                            <EvidenceCapture
                              taskId={task.id}
                              onEvidenceAdded={onRefresh}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {/* Add Material Modal */}
      {addMaterialTaskId && (
        <div className="tl-modal-overlay" onClick={closeAddMaterial}>
          <div className="tl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tl-modal-header">
              <h4 style={{ margin: 0 }}>Add Material</h4>
              <button onClick={closeAddMaterial} className="tl-modal-close">✕</button>
            </div>
            <div className="tl-modal-body">
              <div style={{ position: "relative", marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  Search Catalog
                </label>
                {selectedMat ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "#f3f4f6", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{selectedMat.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                        {selectedMat.partNumber && `P/N: ${selectedMat.partNumber}`}
                        {selectedMat.partNumber && selectedMat.manufacturer && " · "}
                        {selectedMat.manufacturer}
                        {selectedMat.unitCost != null && ` · $${selectedMat.unitCost.toFixed(2)}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMat(null)}
                      style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={matSearch}
                      onChange={(e) => handleMatSearchChange(e.target.value)}
                      placeholder="Type to search materials..."
                      autoComplete="off"
                      style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "0.9rem" }}
                    />
                    {searchingMats && (
                      <div style={{ position: "absolute", right: "0.75rem", top: "2rem", width: "16px", height: "16px", border: "2px solid #e5e7eb", borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 0.6s linear infinite" }}></div>
                    )}
                    {showMatDropdown && matResults.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto" }}>
                        {matResults.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => { setSelectedMat(m); setShowMatDropdown(false); setMatSearch(""); }}
                            style={{ padding: "0.5rem 0.75rem", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                          >
                            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{m.name}</div>
                            <div style={{ fontSize: "0.8rem", color: "#6b7280", display: "flex", gap: "0.75rem" }}>
                              {m.partNumber && <span>P/N: {m.partNumber}</span>}
                              {m.manufacturer && <span>{m.manufacturer}</span>}
                              {m.unitCost != null && <span>${m.unitCost.toFixed(2)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showMatDropdown && matResults.length === 0 && matSearch.trim() && !searchingMats && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "0.75rem", color: "#6b7280", fontSize: "0.85rem", textAlign: "center" }}>
                        No materials found
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={matQuantity}
                    onChange={(e) => setMatQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "0.9rem" }}
                  />
                </div>
                {selectedMat?.unitCost != null && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.25rem" }}>Est. Total</label>
                    <div style={{ padding: "0.5rem 0.75rem", background: "#f3f4f6", borderRadius: "8px", fontSize: "0.9rem", fontWeight: 600, color: "#059669" }}>
                      ${(selectedMat.unitCost * matQuantity).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="tl-modal-footer">
              <button onClick={closeAddMaterial} className="btn btn-secondary" disabled={addingMaterial}>Cancel</button>
              <button onClick={handleAddMaterial} className="btn btn-primary" disabled={!selectedMat || addingMaterial}>
                {addingMaterial ? "Adding..." : "Add Material"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
