"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReportTemplate } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import "./reports.css";

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

export default function ReportsPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
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
    loadTemplates();
  }, []);

  const filtered = templates.filter((t) => {
    const matchesSearch =
      search.trim() === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = templates.filter((t) => t.status === "ACTIVE").length;
  const draftCount = templates.filter((t) => t.status === "DRAFT").length;

  return (
    <div className="reports-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Reports</h1>
          <p className="page-subtitle">
            Generate and manage customer-ready service reports
          </p>
        </div>
        <div className="page-header-right">
          <Link href="/reports/responses" className="reports-btn-secondary">
            Form Responses
          </Link>
          <Link href="/reports/templates" className="reports-btn-secondary">
            Manage Templates
          </Link>
          <Link href="/reports/templates" className="reports-btn-primary">
            + New Report
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="reports-stats-grid">
        <div className="reports-stat-card">
          <div className="reports-stat-icon templates">T</div>
          <div className="reports-stat-content">
            <h3>{templates.length}</h3>
            <p>Total Templates</p>
          </div>
        </div>
        <div className="reports-stat-card">
          <div className="reports-stat-icon active">A</div>
          <div className="reports-stat-content">
            <h3>{activeCount}</h3>
            <p>Active Templates</p>
          </div>
        </div>
        <div className="reports-stat-card">
          <div className="reports-stat-icon drafts">D</div>
          <div className="reports-stat-content">
            <h3>{draftCount}</h3>
            <p>Drafts</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="reports-section-header">
        <h2>Quick Actions</h2>
      </div>
      <div className="reports-quick-actions">
        <Link href="/reports/templates" className="reports-quick-action">
          <div className="reports-quick-action-icon">+</div>
          <div className="reports-quick-action-text">
            <h4>Create Template</h4>
            <p>Design a new report layout</p>
          </div>
        </Link>
        <Link href="/visits" className="reports-quick-action">
          <div className="reports-quick-action-icon">V</div>
          <div className="reports-quick-action-text">
            <h4>Visit Reports</h4>
            <p>Generate from completed visits</p>
          </div>
        </Link>
        <Link href="/work-orders" className="reports-quick-action">
          <div className="reports-quick-action-icon">W</div>
          <div className="reports-quick-action-text">
            <h4>Work Order Reports</h4>
            <p>Summaries from work orders</p>
          </div>
        </Link>
        <Link href="/reports/responses" className="reports-quick-action">
          <div className="reports-quick-action-icon">F</div>
          <div className="reports-quick-action-text">
            <h4>Form Responses</h4>
            <p>View submitted field data</p>
          </div>
        </Link>
      </div>

      {/* Templates List */}
      <div className="reports-section-header">
        <h2>Report Templates</h2>
        <Link href="/reports/templates" className="reports-section-link">
          View All
        </Link>
      </div>

      {/* Search and Filter */}
      <div className="reports-search-section">
        <div className="reports-search-wrapper">
          <span className="reports-search-icon">S</span>
          <input
            type="text"
            className="reports-search-input"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="reports-filter-buttons">
          {["ALL", "ACTIVE", "DRAFT", "ARCHIVED"].map((status) => (
            <button
              key={status}
              type="button"
              className={`reports-filter-btn ${statusFilter === status ? "active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="reports-loading">
          <div className="reports-spinner" />
          <p>Loading reports...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="reports-empty-state">
          <div className="reports-empty-icon">R</div>
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
            <Link href="/reports/templates" className="reports-btn-primary">
              + Create First Template
            </Link>
          )}
        </div>
      ) : (
        <div className="reports-templates-grid">
          {filtered.map((template) => (
            <Link
              key={template.id}
              href={`/reports/templates/${template.id}`}
              className="reports-template-card"
            >
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
                    {formatDate(template.updatedAt)}
                  </span>
                  <span className="reports-template-meta-label">Last Updated</span>
                </div>
                <div className="reports-template-meta-item">
                  <span className="reports-template-meta-value">
                    {formatDate(template.createdAt)}
                  </span>
                  <span className="reports-template-meta-label">Created</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
