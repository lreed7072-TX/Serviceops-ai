"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import "../reports.css";
import "./responses.css";

type TemplateSummary = { id: string; name: string };
type WorkOrderSummary = { id: string; workOrderNumber: string; title: string };
type UserSummary = { id: string; name: string };

interface FormResponseRow {
  id: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  submittedAt: string | null;
  reportTemplate: TemplateSummary;
  workOrder: WorkOrderSummary | null;
  filledBy: UserSummary | null;
}

type ListResponse = {
  data?: FormResponseRow[];
  total?: number;
  limit?: number;
  offset?: number;
};

type TemplateListResponse = {
  data?: TemplateSummary[];
};

const PAGE_SIZE = 25;

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const STATUS_OPTIONS = ["ALL", "DRAFT", "SUBMITTED", "REVIEWED", "EXPORTED"] as const;

export default function FormResponsesListPage() {
  const [responses, setResponses] = useState<FormResponseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [templateFilter, setTemplateFilter] = useState<string>("ALL");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);

  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Load template list for the filter dropdown
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await apiFetch("/api/report-templates");
        if (res.ok) {
          const payload = (await res.json()) as TemplateListResponse;
          setTemplates(payload.data ?? []);
        }
      } catch {
        // Non-critical — filter just won't have template options
      }
    };
    loadTemplates();
  }, []);

  const loadResponses = useCallback(
    async (offset = 0, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (templateFilter !== "ALL") params.set("templateId", templateFilter);

        const res = await apiFetch(`/api/form-responses?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const payload = (await res.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load responses.");
        }

        const payload = (await res.json()) as ListResponse;
        const data = payload.data ?? [];

        if (append) {
          setResponses((prev) => [...prev, ...data]);
        } else {
          setResponses(data);
        }
        setTotal(payload.total ?? data.length);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load responses.");
        if (!append) setResponses([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, templateFilter]
  );

  useEffect(() => {
    loadResponses(0, false);
  }, [loadResponses]);

  const handleLoadMore = () => {
    loadResponses(responses.length, true);
  };

  const handleExportPdf = async (id: string) => {
    setExportingId(id);
    try {
      const res = await apiFetch(`/api/form-responses/${id}/pdf`, {
        method: "POST",
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to generate PDF.");
      }

      // Trigger download
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      let filename = "report.pdf";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Refresh to pick up EXPORTED status
      await loadResponses(0, false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to export PDF.");
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    setDeletingId(pendingDeleteId);
    try {
      const res = await apiFetch(`/api/form-responses/${pendingDeleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete response.");
      }

      setResponses((prev) => prev.filter((r) => r.id !== pendingDeleteId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete response.");
    } finally {
      setDeletingId(null);
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  };

  const canExport = (status: string) =>
    status === "SUBMITTED" || status === "REVIEWED" || status === "EXPORTED";

  const hasMore = responses.length < total;

  return (
    <div className="reports-page">
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports" },
          { label: "Form Responses" },
        ]}
      />

      <div className="page-header" style={{ marginTop: "1rem" }}>
        <div className="page-header-left">
          <h1>Form Responses</h1>
          <p className="page-subtitle">
            View and manage submitted form data from the field
          </p>
        </div>
        <div className="page-header-right">
          <button
            type="button"
            className="reports-btn-secondary"
            onClick={() => loadResponses(0, false)}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="responses-filter-bar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All Statuses" : s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          aria-label="Filter by template"
        >
          <option value="ALL">All Templates</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {loading ? (
        <div className="reports-loading">
          <div className="reports-spinner" />
          <p>Loading responses...</p>
        </div>
      ) : responses.length === 0 ? (
        <div className="reports-empty-state">
          <h3>No form responses found</h3>
          <p>
            {statusFilter !== "ALL" || templateFilter !== "ALL"
              ? "Try adjusting your filters."
              : "Form responses will appear here when techs fill out report templates in the field."}
          </p>
        </div>
      ) : (
        <>
          <p className="responses-count">
            Showing {responses.length} of {total} response{total !== 1 ? "s" : ""}
          </p>

          <div className="responses-table-wrapper">
            <table className="responses-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Work Order</th>
                  <th>Status</th>
                  <th>Filled By</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((row) => (
                  <tr key={row.id}>
                    <td className="responses-table-name">
                      {row.reportTemplate?.name ?? "Unknown"}
                    </td>
                    <td>
                      {row.workOrder ? (
                        <Link
                          href={`/work-orders/${row.workOrder.id}`}
                          className="reports-table-link"
                        >
                          {row.workOrder.workOrderNumber}
                        </Link>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>Standalone</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`response-status-badge ${row.status.toLowerCase()}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.filledBy?.name ?? "--"}</td>
                    <td>{formatDate(row.updatedAt)}</td>
                    <td>
                      <div className="responses-table-actions">
                        <Link
                          href={`/reports/responses/${row.id}`}
                          className="response-action-btn view"
                        >
                          View
                        </Link>
                        {canExport(row.status) && (
                          <button
                            type="button"
                            className="response-action-btn export"
                            onClick={() => handleExportPdf(row.id)}
                            disabled={exportingId === row.id}
                          >
                            {exportingId === row.id ? "Exporting..." : "Export PDF"}
                          </button>
                        )}
                        {row.status === "DRAFT" && (
                          <button
                            type="button"
                            className="response-action-btn delete"
                            onClick={() => handleDelete(row.id)}
                            disabled={deletingId === row.id}
                          >
                            {deletingId === row.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="responses-load-more">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : `Load More (${total - responses.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setPendingDeleteId(null); }}
        onConfirm={confirmDelete}
        title="Delete Draft Response"
        message="Delete this draft response? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deletingId !== null}
      />
    </div>
  );
}
