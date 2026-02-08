"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import EvidenceCapture from "./EvidenceCapture";
import MeasurementEntry from "./MeasurementEntry";
import "./TaskList.css";

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
      alert("Failed to update task status");
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
                          {task.materialUsages.length > 0 && (
                            <div className="tl-detail-section">
                              <h5>Materials Used</h5>
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
                            </div>
                          )}

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
    </div>
  );
}
