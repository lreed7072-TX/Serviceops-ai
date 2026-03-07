"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReportTemplate } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { Pencil, Eye, RefreshCw } from "lucide-react";
import "../reports.css";

type ListResponse<T> = {
  data?: T[];
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export default function ReportTemplatesPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const canWrite = true;

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/report-templates", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load templates.");
      }
      const payload = (await response.json()) as ListResponse<ReportTemplate>;
      setTemplates(payload.data ?? []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load templates.");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setFormError("Name is required.");
      return;
    }

    setFormError(null);
    setSaving(true);

    try {
      const response = await apiFetch("/api/report-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() ? description.trim() : null,
          status,
          definition: {},
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to create template.");
      }

      setName("");
      setDescription("");
      setStatus("DRAFT");
      setFormOpen(false);
      await loadTemplates();
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Failed to create template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Report Templates</h2>
          <p>Manage reusable report layouts and metadata.</p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="link-button"
            onClick={() => setFormOpen((prev) => !prev)}
          >
            {formOpen ? "Close" : "New Template"}
          </button>
        )}
      </div>

      {formOpen && canWrite && (
        <div className="card">
          <h3>New template</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Quarterly Inspection"
                required
              />
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional notes for the template"
              />
            </label>
            <label className="form-field">
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            {formError && <p className="form-feedback error">{formError}</p>}
            <button type="button" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create template"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Templates</h3>
          <button type="button" className="link-button" onClick={loadTemplates}>
            <RefreshCw size={14} style={{ marginRight: 4 }} /> Refresh
          </button>
        </div>

        {error && <p className="form-feedback error">{error}</p>}
        {loading ? (
          <p>Loading templates…</p>
        ) : templates.length === 0 ? (
          <p>No templates yet.</p>
        ) : (
          <ul className="task-list">
            {templates.map((template) => (
              <li key={template.id} className="task-item">
                <div className="task-meta-row">
                  <div>
                    <strong>{template.name}</strong>
                    <p className="muted">
                      {template.status} · Updated {formatDate(template.updatedAt)}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Link className="link-button" href={`/reports/templates/${template.id}/builder`}>
                      <Pencil size={14} style={{ marginRight: 4 }} /> Builder
                    </Link>
                    <Link className="link-button" href={`/reports/templates/${template.id}`}>
                      <Eye size={14} style={{ marginRight: 4 }} /> View
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
