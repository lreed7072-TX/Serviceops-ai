"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import PMScheduleCard from "@/components/pm/PMScheduleCard";
import "./pm-schedules.css";

interface PMSchedule {
  id: string;
  name: string;
  description: string | null;
  status: string;
  frequencyType: string | null;
  frequencyValue: number | null;
  nextScheduledDate: string | null;
  daysUntilNext: number | null;
  autoGenerateWorkOrders: boolean;
  asset: { id: string; name: string; serialNumber: string | null } | null;
  site: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  procedureTemplate: { id: string; name: string } | null;
  lastGeneratedWorkOrder: {
    id: string;
    workOrderNumber: string | null;
    status: string;
    dueDate: string | null;
  } | null;
}

interface AssetOption {
  id: string;
  name: string;
  serialNumber: string | null;
  siteId: string;
  site: { customerId: string };
}

export default function PMSchedulesPage() {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    assetId: "",
    frequencyType: "MONTHLY",
    frequencyValue: "1",
    workOrderTitle: "",
    priority: "MEDIUM",
    estimatedHours: "",
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSchedules = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await apiFetch(`/api/pm-schedules${params}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setSchedules(json.data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await apiFetch("/api/assets", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setAssets(json.data ?? []);
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    if (showCreateForm) fetchAssets();
  }, [showCreateForm]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.assetId) {
      setFormError("Name and equipment are required");
      return;
    }

    setCreating(true);
    setFormError(null);

    try {
      const res = await apiFetch("/api/pm-schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          assetId: form.assetId,
          frequencyType: form.frequencyType,
          frequencyValue: parseInt(form.frequencyValue),
          workOrderTitle: form.workOrderTitle.trim() || null,
          priority: form.priority,
          estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }

      setShowCreateForm(false);
      setForm({
        name: "",
        description: "",
        assetId: "",
        frequencyType: "MONTHLY",
        frequencyValue: "1",
        workOrderTitle: "",
        priority: "MEDIUM",
        estimatedHours: "",
      });
      fetchSchedules();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create schedule");
    } finally {
      setCreating(false);
    }
  };

  const activeCount = schedules.filter((s) => s.status === "ACTIVE").length;
  const dueSoonCount = schedules.filter(
    (s) => s.daysUntilNext !== null && s.daysUntilNext >= 0 && s.daysUntilNext <= 7
  ).length;
  const overdueCount = schedules.filter(
    (s) => s.daysUntilNext !== null && s.daysUntilNext < 0
  ).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>PM Schedules</h1>
          <p className="page-subtitle">
            Preventive maintenance scheduling and automation
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? "Cancel" : "+ Create PM Schedule"}
        </button>
      </div>

      {/* Stats */}
      <div className="pm-stats-grid">
        <div className="pm-stat-card">
          <div className="pm-stat-value">{activeCount}</div>
          <div className="pm-stat-label">Active Schedules</div>
        </div>
        <div className="pm-stat-card warning">
          <div className="pm-stat-value">{dueSoonCount}</div>
          <div className="pm-stat-label">Due Within 7 Days</div>
        </div>
        <div className="pm-stat-card error">
          <div className="pm-stat-value">{overdueCount}</div>
          <div className="pm-stat-label">Overdue</div>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="pm-create-panel">
          <h3>New PM Schedule</h3>
          {formError && (
            <div className="ec-error" style={{ marginBottom: "1rem" }}>
              {formError}
            </div>
          )}
          <div className="pm-form-grid">
            <div className="pm-form-field">
              <label>Schedule Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Quarterly Pump PM"
              />
            </div>
            <div className="pm-form-field">
              <label>Equipment *</label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
              >
                <option value="">Select equipment...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.serialNumber ? ` (${a.serialNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="pm-form-field">
              <label>Frequency</label>
              <select
                value={form.frequencyType}
                onChange={(e) =>
                  setForm({ ...form, frequencyType: e.target.value })
                }
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div className="pm-form-field">
              <label>Every X intervals</label>
              <input
                type="number"
                min="1"
                max="365"
                value={form.frequencyValue}
                onChange={(e) =>
                  setForm({ ...form, frequencyValue: e.target.value })
                }
              />
            </div>
            <div className="pm-form-field">
              <label>Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="pm-form-field">
              <label>Estimated Hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.estimatedHours}
                onChange={(e) =>
                  setForm({ ...form, estimatedHours: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div className="pm-form-field full">
              <label>WO Title Template</label>
              <input
                type="text"
                value={form.workOrderTitle}
                onChange={(e) =>
                  setForm({ ...form, workOrderTitle: e.target.value })
                }
                placeholder="Auto-generated if blank"
              />
            </div>
            <div className="pm-form-field full">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional notes about this PM schedule"
                rows={2}
              />
            </div>
          </div>
          <div className="pm-form-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Creating..." : "Create Schedule"}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="pm-filter-bar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {/* Schedule List */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
          Loading schedules...
        </p>
      ) : schedules.length === 0 ? (
        <div className="pm-empty">
          <div className="pm-empty-icon">🔧</div>
          <h2>No PM Schedules Yet</h2>
          <p>
            Create your first preventive maintenance schedule to automate recurring
            work orders.
          </p>
          {!showCreateForm && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateForm(true)}
            >
              Create PM Schedule
            </button>
          )}
        </div>
      ) : (
        <div className="pm-schedule-grid">
          {schedules.map((schedule) => (
            <PMScheduleCard
              key={schedule.id}
              schedule={schedule}
              onRefresh={fetchSchedules}
            />
          ))}
        </div>
      )}
    </div>
  );
}
