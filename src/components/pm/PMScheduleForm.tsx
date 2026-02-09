"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import "./PMScheduleForm.css";

interface Asset {
  id: string;
  name: string;
  serialNumber: string | null;
}

interface ProcedureTemplate {
  id: string;
  name: string;
  description: string | null;
  assetCategory: string | null;
}

interface PMScheduleFormProps {
  assets: Asset[];
  procedureTemplates: ProcedureTemplate[];
  preselectedAssetId?: string;
}

export default function PMScheduleForm({
  assets,
  procedureTemplates,
  preselectedAssetId,
}: PMScheduleFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assetId, setAssetId] = useState(preselectedAssetId || "");
  const [procedureTemplateId, setProcedureTemplateId] = useState("");
  const [frequencyType, setFrequencyType] = useState("MONTHLY");
  const [frequencyValue, setFrequencyValue] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [workOrderTitle, setWorkOrderTitle] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !assetId || !frequencyValue) {
      setError("Please fill in all required fields");
      return;
    }

    const freq = parseInt(frequencyValue);
    if (freq < 1 || freq > 365) {
      setError("Frequency value must be between 1 and 365");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        assetId,
        procedureTemplateId: procedureTemplateId || null,
        frequencyType,
        frequencyValue: freq,
        startDate: startDate || null,
        autoGenerateWorkOrders: autoGenerate,
        workOrderTitle: workOrderTitle.trim() || `PM: ${name.trim()}`,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        priority,
      };

      const res = await apiFetch("/api/pm-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create PM schedule");
      }

      router.push("/pm-schedules");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create PM schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pm-schedule-form">
      {error && (
        <div className="form-error">{error}</div>
      )}

      <div className="form-section">
        <h2>Basic Information</h2>

        <div className="form-grid">
          <div className="form-field">
            <label>PM Schedule Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quarterly Bearing Inspection"
              required
            />
          </div>

          <div className="form-field full-width">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this PM schedule covers..."
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Equipment</h2>

        <div className="form-grid">
          <div className="form-field">
            <label>Equipment *</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              required
            >
              <option value="">Select equipment...</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                  {asset.serialNumber ? ` (${asset.serialNumber})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Schedule Frequency</h2>

        <div className="form-grid">
          <div className="form-field">
            <label>Frequency Type *</label>
            <select
              value={frequencyType}
              onChange={(e) => setFrequencyType(e.target.value)}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          <div className="form-field">
            <label>Every *</label>
            <div className="input-with-suffix">
              <input
                type="number"
                min="1"
                max="365"
                value={frequencyValue}
                onChange={(e) => setFrequencyValue(e.target.value)}
                required
              />
              <span className="input-suffix">
                {frequencyType === "DAILY" && "day(s)"}
                {frequencyType === "WEEKLY" && "week(s)"}
                {frequencyType === "MONTHLY" && "month(s)"}
                {frequencyType === "YEARLY" && "year(s)"}
              </span>
            </div>
          </div>

          <div className="form-field">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <small>Leave blank to start from today</small>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Procedure Template (Optional)</h2>

        <div className="form-grid">
          <div className="form-field full-width">
            <label>Template</label>
            <select
              value={procedureTemplateId}
              onChange={(e) => setProcedureTemplateId(e.target.value)}
            >
              <option value="">No template (create tasks manually)</option>
              {procedureTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.assetCategory ? ` - ${template.assetCategory}` : ""}
                </option>
              ))}
            </select>
            <small>
              Tasks will be auto-created from template when work orders are generated
            </small>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Work Order Settings</h2>

        <div className="form-grid">
          <div className="form-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
                className="checkbox-input"
              />
              Auto-generate work orders
            </label>
            <small>Automatically create work orders when PM is due</small>
          </div>

          <div className="form-field">
            <label>Work Order Title Template</label>
            <input
              type="text"
              value={workOrderTitle}
              onChange={(e) => setWorkOrderTitle(e.target.value)}
              placeholder={`PM: ${name || "Schedule Name"}`}
            />
          </div>

          <div className="form-field">
            <label>Estimated Hours</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="0.0"
            />
          </div>

          <div className="form-field">
            <label>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Creating..." : "Create PM Schedule"}
        </button>
      </div>
    </form>
  );
}
