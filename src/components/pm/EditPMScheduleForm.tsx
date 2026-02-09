"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import "./PMScheduleForm.css";

interface EditPMScheduleFormProps {
  schedule: Record<string, unknown>;
  procedureTemplates: { id: string; name: string; assetCategory: string | null }[];
}

export default function EditPMScheduleForm({
  schedule,
  procedureTemplates,
}: EditPMScheduleFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asset = schedule.asset as { name: string } | null;
  const customer = schedule.customer as { name: string } | null;
  const site = schedule.site as { name: string } | null;

  const [name, setName] = useState(schedule.name as string);
  const [description, setDescription] = useState((schedule.description as string) || "");
  const [status, setStatus] = useState(schedule.status as string);
  const [procedureTemplateId, setProcedureTemplateId] = useState(
    (schedule.procedureTemplateId as string) || ""
  );
  const [frequencyType, setFrequencyType] = useState(schedule.frequencyType as string);
  const [frequencyValue, setFrequencyValue] = useState(
    String(schedule.frequencyValue)
  );
  const [nextScheduledDate, setNextScheduledDate] = useState(() => {
    const d = schedule.nextScheduledDate as string | null;
    return d ? new Date(d).toISOString().split("T")[0] : "";
  });
  const [autoGenerate, setAutoGenerate] = useState(
    schedule.autoGenerateWorkOrders as boolean
  );
  const [workOrderTitle, setWorkOrderTitle] = useState(
    (schedule.workOrderTitle as string) || ""
  );
  const [estimatedHours, setEstimatedHours] = useState(
    schedule.estimatedHours ? String(schedule.estimatedHours) : ""
  );
  const [priority, setPriority] = useState((schedule.priority as string) || "MEDIUM");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !frequencyValue) {
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
        status,
        procedureTemplateId: procedureTemplateId || null,
        frequencyType,
        frequencyValue: freq,
        nextScheduledDate: nextScheduledDate || null,
        autoGenerateWorkOrders: autoGenerate,
        workOrderTitle: workOrderTitle.trim() || null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        priority,
      };

      const res = await apiFetch(`/api/pm-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update PM schedule");
      }

      router.push(`/pm-schedules/${schedule.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update PM schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to archive "${schedule.name}"? This will stop all automatic work order generation.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/pm-schedules/${schedule.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to archive PM schedule");
      }

      router.push("/pm-schedules");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive PM schedule");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pm-schedule-form">
      {error && <div className="form-error">{error}</div>}

      <div className="form-section">
        <h2>Basic Information</h2>
        <div className="form-grid">
          <div className="form-field">
            <label>PM Schedule Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label>Status *</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div className="form-field full-width">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h2>Equipment &amp; Location</h2>
        <div className="form-grid">
          <div className="form-field">
            <label>Equipment</label>
            <input
              type="text"
              value={asset?.name || "Unknown"}
              disabled
              style={{ background: "#f9fafb", cursor: "not-allowed" }}
            />
            <small>Equipment cannot be changed after creation</small>
          </div>
          {customer && site && (
            <div className="form-field">
              <label>Location</label>
              <input
                type="text"
                value={`${customer.name} \u2022 ${site.name}`}
                disabled
                style={{ background: "#f9fafb", cursor: "not-allowed" }}
              />
            </div>
          )}
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
            <label>Next Scheduled Date</label>
            <input
              type="date"
              value={nextScheduledDate}
              onChange={(e) => setNextScheduledDate(e.target.value)}
            />
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
              <option value="">No template</option>
              {procedureTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.assetCategory ? ` - ${template.assetCategory}` : ""}
                </option>
              ))}
            </select>
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
          onClick={handleDelete}
          disabled={deleting}
          className="btn btn-danger"
        >
          {deleting ? "Archiving..." : "Archive Schedule"}
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
