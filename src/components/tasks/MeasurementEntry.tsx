"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import "./MeasurementEntry.css";

type Measurement = {
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

interface MeasurementEntryProps {
  taskId: string;
  measurements: Measurement[];
  onRefresh: () => void;
}

export default function MeasurementEntry({
  taskId,
  measurements,
  onRefresh,
}: MeasurementEntryProps) {
  const [localValues, setLocalValues] = useState<
    Record<string, { numeric?: string; text?: string; passFail?: boolean | null }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add measurement modal state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"NUMERIC" | "TEXT" | "PASS_FAIL">("NUMERIC");
  const [newUnit, setNewUnit] = useState("");
  const [newMin, setNewMin] = useState("");
  const [newMax, setNewMax] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);

  const getLocal = useCallback(
    (m: Measurement) => {
      if (localValues[m.id]) return localValues[m.id];
      return {
        numeric: m.numericValue !== null ? String(m.numericValue) : "",
        text: m.textValue ?? "",
        passFail: m.passFail,
      };
    },
    [localValues]
  );

  const setLocal = (id: string, patch: Partial<{ numeric: string; text: string; passFail: boolean | null }>) => {
    setLocalValues((prev) => ({
      ...prev,
      [id]: { ...getLocalById(id), ...patch },
    }));
  };

  const getLocalById = (id: string) => {
    const m = measurements.find((x) => x.id === id);
    if (localValues[id]) return localValues[id];
    return {
      numeric: m?.numericValue !== null ? String(m?.numericValue ?? "") : "",
      text: m?.textValue ?? "",
      passFail: m?.passFail ?? null,
    };
  };

  const hasChanged = (m: Measurement): boolean => {
    const local = localValues[m.id];
    if (!local) return false;

    if (m.measurementType === "NUMERIC") {
      const newVal = local.numeric?.trim() ? parseFloat(local.numeric) : null;
      return newVal !== m.numericValue;
    }
    if (m.measurementType === "TEXT") {
      return (local.text ?? "") !== (m.textValue ?? "");
    }
    if (m.measurementType === "PASS_FAIL") {
      return local.passFail !== m.passFail;
    }
    return false;
  };

  const saveMeasurement = async (m: Measurement) => {
    const local = getLocal(m);
    setSaving(m.id);
    setError(null);

    const body: Record<string, unknown> = { measurementId: m.id };

    if (m.measurementType === "NUMERIC") {
      body.numericValue = local.numeric?.trim() ? parseFloat(local.numeric) : null;
    } else if (m.measurementType === "TEXT") {
      body.textValue = local.text ?? null;
    } else if (m.measurementType === "PASS_FAIL") {
      body.passFail = local.passFail ?? null;
    }

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/measurements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Clear local edits for this measurement
      setLocalValues((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      onRefresh();
    } catch {
      setError("Failed to save measurement");
    } finally {
      setSaving(null);
    }
  };

  const handleAddMeasurement = async () => {
    if (!newName.trim()) return;
    setAddingSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      name: newName.trim(),
      measurementType: newType,
    };

    if (newType === "NUMERIC") {
      if (newUnit.trim()) body.unit = newUnit.trim();
      if (newMin.trim()) body.minValue = parseFloat(newMin);
      if (newMax.trim()) body.maxValue = parseFloat(newMax);
    }

    try {
      const res = await apiFetch(`/api/tasks/${taskId}/measurements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to add");
      resetModal();
      onRefresh();
    } catch {
      setError("Failed to add measurement");
    } finally {
      setAddingSaving(false);
    }
  };

  const resetModal = () => {
    setShowAddModal(false);
    setNewName("");
    setNewType("NUMERIC");
    setNewUnit("");
    setNewMin("");
    setNewMax("");
  };

  const formatSpec = (m: Measurement): string => {
    if (m.measurementType !== "NUMERIC") return "";
    const parts: string[] = [];
    if (m.minValue != null) parts.push(`Min: ${m.minValue}`);
    if (m.maxValue != null) parts.push(`Max: ${m.maxValue}`);
    if (m.unit) parts.push(m.unit);
    return parts.join(" | ");
  };

  return (
    <div className="me-container">
      {error && <div className="ec-error">{error}</div>}

      {measurements.length === 0 ? (
        <p className="me-empty">No measurements defined for this task</p>
      ) : (
        measurements.map((m) => {
          const local = getLocal(m);
          const changed = hasChanged(m);
          const specStr = formatSpec(m);
          const itemClass = m.isWithinSpec === true
            ? "in-spec"
            : m.isWithinSpec === false
              ? "out-of-spec"
              : "";

          return (
            <div key={m.id} className={`me-item ${itemClass}`}>
              <div className="me-item-info">
                <p className="me-item-name">{m.name}</p>
                {specStr && <span className="me-item-spec">{specStr}</span>}
                {m.capturedAt && m.capturedByUser && (
                  <div className="me-captured">
                    {m.capturedByUser.name || m.capturedByUser.email} &bull;{" "}
                    {new Date(m.capturedAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="me-item-input">
                {m.measurementType === "NUMERIC" && (
                  <>
                    <input
                      type="number"
                      step="any"
                      className="me-numeric-input"
                      value={local.numeric ?? ""}
                      onChange={(e) => setLocal(m.id, { numeric: e.target.value })}
                      placeholder="Value"
                    />
                    {m.unit && <span className="me-unit">{m.unit}</span>}
                  </>
                )}

                {m.measurementType === "TEXT" && (
                  <input
                    type="text"
                    className="me-text-input"
                    value={local.text ?? ""}
                    onChange={(e) => setLocal(m.id, { text: e.target.value })}
                    placeholder="Enter value"
                  />
                )}

                {m.measurementType === "PASS_FAIL" && (
                  <div className="me-pf-group">
                    <button
                      className={`me-pf-btn ${local.passFail === true ? "pass-active" : ""}`}
                      onClick={() => setLocal(m.id, { passFail: true })}
                    >
                      Pass
                    </button>
                    <button
                      className={`me-pf-btn ${local.passFail === false ? "fail-active" : ""}`}
                      onClick={() => setLocal(m.id, { passFail: false })}
                    >
                      Fail
                    </button>
                  </div>
                )}

                {m.isWithinSpec !== null && (
                  <span className={`me-spec-badge ${m.isWithinSpec ? "in-spec" : "out-spec"}`}>
                    {m.isWithinSpec ? "In Spec" : "Out of Spec"}
                  </span>
                )}

                {changed && (
                  <button
                    className="me-save-btn"
                    onClick={() => saveMeasurement(m)}
                    disabled={saving === m.id}
                  >
                    {saving === m.id ? "..." : "Save"}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Add Measurement Button */}
      <button className="me-add-btn" onClick={() => setShowAddModal(true)}>
        + Add Measurement
      </button>

      {/* Add Measurement Modal */}
      {showAddModal && (
        <div className="me-modal-overlay" onClick={() => !addingSaving && resetModal()}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()}>
            <div className="me-modal-header">
              <h4>Add Measurement</h4>
              <button className="me-modal-close" onClick={resetModal}>
                &times;
              </button>
            </div>
            <div className="me-modal-body">
              <div className="me-field">
                <label>Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Bearing Temperature"
                  autoFocus
                />
              </div>

              <div className="me-field">
                <label>Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "NUMERIC" | "TEXT" | "PASS_FAIL")}
                >
                  <option value="NUMERIC">Numeric</option>
                  <option value="TEXT">Text</option>
                  <option value="PASS_FAIL">Pass / Fail</option>
                </select>
              </div>

              {newType === "NUMERIC" && (
                <>
                  <div className="me-field">
                    <label>Unit (optional)</label>
                    <input
                      type="text"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      placeholder="e.g., PSI, °F, mA"
                    />
                  </div>
                  <div className="me-spec-row">
                    <div className="me-field">
                      <label>Min Spec</label>
                      <input
                        type="number"
                        step="any"
                        value={newMin}
                        onChange={(e) => setNewMin(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="me-field">
                      <label>Max Spec</label>
                      <input
                        type="number"
                        step="any"
                        value={newMax}
                        onChange={(e) => setNewMax(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="me-modal-footer">
              <button className="btn btn-secondary" onClick={resetModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddMeasurement}
                disabled={!newName.trim() || addingSaving}
              >
                {addingSaving ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
