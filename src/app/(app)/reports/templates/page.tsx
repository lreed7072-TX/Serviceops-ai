"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportTemplate } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import {
  FileText,
  Plus,
  Search,
  Pencil,
  Eye,
  RefreshCw,
  CheckCircle,
  Archive,
  FilePlus,
  X,
} from "lucide-react";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { useToast } from "@/components/ui/Toast";
import "../reports.css";
import "./templates.css";

type ListResponse<T> = {
  data?: T[];
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "--";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function ReportTemplatesPage() {
  const router = useRouter();
  const toast = useToast();

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/report-templates", {
        cache: "no-store",
      });
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

  /* Filtering */
  const filtered = templates.filter((t) => {
    const matchesSearch =
      search.trim() === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  /* Counts */
  const activeCount = templates.filter((t) => t.status === "ACTIVE").length;
  const draftCount = templates.filter((t) => t.status === "DRAFT").length;
  const archivedCount = templates.filter((t) => t.status === "ARCHIVED").length;

  /* Create handler */
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
      toast.success(`Template "${trimmedName}" created successfully.`);
      await loadTemplates();
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Failed to create template.");
    } finally {
      setSaving(false);
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormError(null);
    setName("");
    setDescription("");
    setStatus("DRAFT");
  };

  return (
    <div className="templates-page">
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports" },
          { label: "Templates" },
        ]}
      />

      {/* Page Header */}
      <div className="templates-page-header">
        <div className="templates-page-header-left">
          <h1>Report Templates</h1>
          <p className="templates-page-subtitle">
            Design and manage reusable report layouts for field service operations
          </p>
        </div>
        <div>
          <button
            type="button"
            className="reports-btn-primary"
            onClick={() => setFormOpen(true)}
          >
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="reports-stats-grid">
        <div className="reports-stat-card">
          <div className="reports-stat-icon templates">
            <FileText size={20} />
          </div>
          <div className="reports-stat-content">
            <h3>{templates.length}</h3>
            <p>Total Templates</p>
          </div>
        </div>
        <div className="reports-stat-card">
          <div className="reports-stat-icon active">
            <CheckCircle size={20} />
          </div>
          <div className="reports-stat-content">
            <h3>{activeCount}</h3>
            <p>Active</p>
          </div>
        </div>
        <div className="reports-stat-card">
          <div className="reports-stat-icon drafts">
            <FilePlus size={20} />
          </div>
          <div className="reports-stat-content">
            <h3>{draftCount}</h3>
            <p>Drafts</p>
          </div>
        </div>
        <div className="reports-stat-card">
          <div className="reports-stat-icon generated">
            <Archive size={20} />
          </div>
          <div className="reports-stat-content">
            <h3>{archivedCount}</h3>
            <p>Archived</p>
          </div>
        </div>
      </div>

      {/* Search + Filter + Refresh */}
      <div className="reports-search-section">
        <div className="reports-search-wrapper">
          <span className="reports-search-icon">
            <Search size={16} />
          </span>
          <input
            type="text"
            className="reports-search-input"
            placeholder="Search templates by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="reports-filter-buttons">
          {["ALL", "ACTIVE", "DRAFT", "ARCHIVED"].map((s) => (
            <button
              key={s}
              type="button"
              className={`reports-filter-btn ${statusFilter === s ? "active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
          <button
            type="button"
            className="reports-btn-secondary"
            onClick={loadTemplates}
            title="Refresh list"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="templates-error-banner">
          <FileText size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="reports-loading">
          <div className="reports-spinner" />
          <p>Loading templates...</p>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div className="reports-empty-state">
          <div className="reports-empty-icon">
            <FileText size={32} />
          </div>
          <h3>
            {search || statusFilter !== "ALL"
              ? "No matching templates"
              : "No report templates yet"}
          </h3>
          <p>
            {search || statusFilter !== "ALL"
              ? "Try adjusting your search or filter criteria."
              : "Create your first report template to start generating professional service reports."}
          </p>
          {!search && statusFilter === "ALL" && (
            <button
              type="button"
              className="reports-btn-primary"
              onClick={() => setFormOpen(true)}
            >
              <Plus size={16} /> Create First Template
            </button>
          )}
        </div>
      ) : (
        /* Template cards grid */
        <div className="reports-templates-grid">
          {filtered.map((template) => (
            <div key={template.id} className="reports-template-card" style={{ cursor: "default" }}>
              <div className="reports-template-card-header">
                <h3 className="reports-template-name">{template.name}</h3>
                <span
                  className={`reports-status-badge ${template.status.toLowerCase()}`}
                >
                  {template.status}
                </span>
              </div>

              {template.description && (
                <p className="reports-template-desc">{template.description}</p>
              )}

              <div className="reports-template-meta">
                <div className="reports-template-meta-item">
                  <span className="reports-template-meta-value">
                    v{template.schemaVersion}
                  </span>
                  <span className="reports-template-meta-label">Schema</span>
                </div>
                <div className="reports-template-meta-item">
                  <span className="reports-template-meta-value">
                    {formatDate(template.updatedAt)}
                  </span>
                  <span className="reports-template-meta-label">Updated</span>
                </div>
                <div className="reports-template-meta-item">
                  <span className="reports-template-meta-value">
                    {formatDate(template.createdAt)}
                  </span>
                  <span className="reports-template-meta-label">Created</span>
                </div>
              </div>

              <div className="templates-card-actions">
                <Link
                  href={`/reports/templates/${template.id}/builder`}
                  className="templates-action-btn primary"
                >
                  <Pencil size={14} /> Builder
                </Link>
                <Link
                  href={`/reports/templates/${template.id}`}
                  className="templates-action-btn"
                >
                  <Eye size={14} /> View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Template Modal */}
      {formOpen && (
        <div
          className="templates-form-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div className="templates-form-modal">
            <div className="templates-form-header">
              <h3>Create New Template</h3>
              <button
                type="button"
                className="templates-form-close"
                onClick={closeForm}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="templates-form-body">
              <div className="templates-form-field">
                <label>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pump Startup Report"
                  autoFocus
                />
              </div>

              <div className="templates-form-field">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this template captures..."
                />
              </div>

              <div className="templates-form-field">
                <label>Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              {formError && (
                <p className="templates-form-error">{formError}</p>
              )}
            </div>

            <div className="templates-form-footer">
              <button
                type="button"
                className="reports-btn-secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="reports-btn-primary"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? "Creating..." : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
