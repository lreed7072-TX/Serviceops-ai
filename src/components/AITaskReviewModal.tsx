"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface AIGeneratedTask {
  title: string;
  description: string;
  domain: string;
  sequenceNumber: number;
  isCritical: boolean;
  requiresEvidence: boolean;
  estimatedMinutes?: number;
  measurements?: Array<{
    name: string;
    unit?: string;
    measurementType: string;
    minValue?: number;
    maxValue?: number;
  }>;
}

interface AITaskPlan {
  id: string;
  status: string;
  llmModel: string;
  tokensUsed?: number;
  durationMs?: number;
  parsedTasksSnapshotJson: AIGeneratedTask[];
}

interface AITaskReviewModalProps {
  aiTaskPlan: AITaskPlan;
  summary: string;
  estimatedTotalDuration: number;
  onClose: () => void;
  onApproved: () => void;
}

export function AITaskReviewModal({
  aiTaskPlan,
  summary,
  estimatedTotalDuration,
  onClose,
  onApproved,
}: AITaskReviewModalProps) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tasks = aiTaskPlan.parsedTasksSnapshotJson || [];

  const handleApprove = async () => {
    if (!confirm(`Approve and create ${tasks.length} tasks?`)) return;

    setApproving(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/ai-task-plans/${aiTaskPlan.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to approve tasks");
      }

      onApproved();
    } catch (e: any) {
      setError(e?.message || "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return; // User cancelled

    setRejecting(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/ai-task-plans/${aiTaskPlan.id}/approve`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        throw new Error("Failed to reject");
      }

      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  const domainColors: Record<string, string> = {
    MECHANICAL: "#10b981",
    ELECTRICAL: "#f59e0b",
    CONTROLS: "#3b82f6",
    INSTRUMENTATION: "#8b5cf6",
    UNIFIED: "#6b7280",
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ background: "rgba(0, 0, 0, 0.75)" }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, background: "#ffffff" }}>
        <div className="modal-header">
          <h2>🤖 AI-Generated Task Plan</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="modal-body">
          {/* Summary */}
          <div className="ai-summary-box" style={{
            background: "#f8f4ff",
            border: "1px solid #c4b5fd",
            borderRadius: 8,
            padding: 16,
            marginBottom: 24
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827" }}>Summary</h3>
                <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6b7280" }}>{summary}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#667eea" }}>
                  {(estimatedTotalDuration / 60).toFixed(1)}h
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {tasks.length} tasks
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280", marginTop: 12 }}>
              <div>Model: {aiTaskPlan.llmModel}</div>
              {aiTaskPlan.tokensUsed && <div>Tokens: {aiTaskPlan.tokensUsed.toLocaleString()}</div>}
              {aiTaskPlan.durationMs && <div>Generated in: {(aiTaskPlan.durationMs / 1000).toFixed(1)}s</div>}
            </div>
          </div>

          {/* Tasks List */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#111827" }}>
              Generated Tasks ({tasks.length})
            </h3>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 8,
                    background: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
                    <div
                      style={{
                        minWidth: 28,
                        height: 28,
                        background: domainColors[task.domain] || "#6b7280",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "white",
                      }}
                    >
                      {task.sequenceNumber}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <strong>{task.title}</strong>
                        {task.isCritical && (
                          <span
                            style={{
                              background: "#ef4444",
                              color: "white",
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 3,
                              fontWeight: 600,
                            }}
                          >
                            CRITICAL
                          </span>
                        )}
                        <span
                          style={{
                            background: domainColors[task.domain] || "#6b7280",
                            color: "white",
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 3,
                          }}
                        >
                          {task.domain}
                        </span>
                        {task.estimatedMinutes && (
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            ~{task.estimatedMinutes} min
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: "#374151" }}>
                        {task.description}
                      </p>

                      {task.measurements && task.measurements.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <strong style={{ color: "#6b7280" }}>Measurements:</strong>
                          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                            {task.measurements.map((m, i) => (
                              <li key={i} style={{ color: "#374151" }}>
                                {m.name}
                                {m.unit && ` (${m.unit})`}
                                {m.minValue !== undefined && ` min: ${m.minValue}`}
                                {m.maxValue !== undefined && ` max: ${m.maxValue}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary" disabled={approving || rejecting}>
            Cancel
          </button>
          <button
            onClick={handleReject}
            className="btn-secondary"
            disabled={approving || rejecting}
            style={{ color: "#ef4444" }}
          >
            {rejecting ? "Rejecting..." : "Reject"}
          </button>
          <button
            onClick={handleApprove}
            className="btn-primary"
            disabled={approving || rejecting}
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none",
            }}
          >
            {approving ? "Approving..." : `✓ Approve & Create ${tasks.length} Tasks`}
          </button>
        </div>
      </div>
    </div>
  );
}
