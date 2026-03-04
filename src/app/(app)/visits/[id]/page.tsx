"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Visit, WorkOrder } from "@prisma/client";
import { VisitStatus } from "@prisma/client";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import "./visit-detail.css";

type SingleResponse<T> = { data: T };

type CloseoutGateResponse = {
  data: {
    canCloseout: boolean;
    blockers: Array<{ message: string }>;
    summary?: { visitId: string };
  };
};

const visitIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

const formatDate = (value?: string | Date | null) => {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const safe = (v: unknown) => {
  if (typeof v !== "string") return "—";
  const t = v.trim();
  return t.length ? t : "—";
};

export default function VisitDetailPage() {
  const params = useParams();
  const visitId = params?.id as string | undefined;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateData, setGateData] = useState<CloseoutGateResponse["data"] | null>(null);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editStatus, setEditStatus] = useState<VisitStatus>(VisitStatus.PLANNED);
  const [editScheduledFor, setEditScheduledFor] = useState("");
  const [editStartedAt, setEditStartedAt] = useState("");
  const [editCompletedAt, setEditCompletedAt] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editOutcome, setEditOutcome] = useState("");

  const primeEdit = (v: Visit) => {
    setEditStatus((v.status ?? VisitStatus.PLANNED) as VisitStatus);
    setEditScheduledFor(v.scheduledFor ? new Date(v.scheduledFor as any).toISOString().slice(0, 16) : "");
    setEditStartedAt(v.startedAt ? new Date(v.startedAt as any).toISOString().slice(0, 16) : "");
    setEditCompletedAt(v.completedAt ? new Date(v.completedAt as any).toISOString().slice(0, 16) : "");
    setEditSummary((v.summary ?? "") as any);
    setEditOutcome((v.outcome ?? "") as any);
  };

  const fetchCloseoutGate = useCallback(async () => {
    if (!visitId) return;
    setGateLoading(true);
    setGateError(null);
    try {
      const response = await apiFetch(`/api/visits/${visitId}/closeout-gate`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) throw new Error("Not found or no access.");
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load closeout gate.");
      }
      const payload = (await response.json()) as CloseoutGateResponse;
      setGateData(payload.data);
    } catch (err) {
      console.error(err);
      setGateError(err instanceof Error ? err.message : "Failed to load closeout gate.");
      setGateData(null);
    } finally {
      setGateLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    if (!visitId) return;
    const parsedId = visitIdSchema.safeParse(visitId);
    if (!parsedId.success) {
      setError("Invalid visit ID.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/visits/${visitId}`, { cache: "no-store" });
        if (!response.ok) {
          if (response.status === 403 || response.status === 404) throw new Error("Not found or no access.");
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load visit.");
        }
        const payload = (await response.json()) as SingleResponse<Visit>;
        if (!cancelled) {
          setVisit(payload.data);
          primeEdit(payload.data);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load visit.");
        setVisit(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  // Load work order details (for human-friendly display)
  useEffect(() => {
    const workOrderId = visit?.workOrderId;
    if (!workOrderId) {
      setWorkOrder(null);
      return;
    }

    let cancelled = false;
    const loadWO = async () => {
      try {
        const res = await apiFetch(`/api/work-orders/${workOrderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as SingleResponse<WorkOrder>;
        if (!cancelled) setWorkOrder(payload.data);
      } catch {
        // ignore
      }
    };

    loadWO();
    return () => {
            cancelled = true;
    };
  }, [visit?.workOrderId]);

  useEffect(() => {
    if (!visitId) return;
    const parsedId = visitIdSchema.safeParse(visitId);
    if (!parsedId.success) return;
    fetchCloseoutGate();
  }, [fetchCloseoutGate, visitId]);

  async function saveVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!visitId) return;
    if (saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await apiFetch(`/api/visits/${visitId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          scheduledFor: editScheduledFor ? new Date(editScheduledFor).toISOString() : null,
          startedAt: editStartedAt ? new Date(editStartedAt).toISOString() : null,
          completedAt: editCompletedAt ? new Date(editCompletedAt).toISOString() : null,
          summary: editSummary.trim() || null,
          outcome: editOutcome.trim() || null,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? `Save failed (${res.status})`);
      }

      const payload = (await res.json()) as SingleResponse<Visit>;
      setVisit(payload.data);
      primeEdit(payload.data);
      setShowEdit(false);
      fetchCloseoutGate();
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save visit.");
    } finally {
      setSaving(false);
    }
  }

  if (!visitId) {
    return (
      <div className="visit-detail-page">
        <div className="missing-id-card">
          <p>Missing visit ID in URL.</p>
        </div>
      </div>
    );
  }

  const woLabel =
    workOrder
      ? `${(workOrder as any).workOrderNumber ?? "WO—"} — ${workOrder.title}`
      : visit?.workOrderId
        ? `Work order ${visit.workOrderId.slice(0, 8)}...`
        : "—";

  return (
    <div className="visit-detail-page">
      {/* Breadcrumb */}
      <Breadcrumbs items={[
        { label: "Visits", href: "/visits" },
        { label: "Visit Details" },
      ]} />

      {/* Page Header */}
      <div className="visit-detail-header">
        <div className="visit-detail-header-left">
          <h2>Visit {(visit as any)?.visitNumber ?? ""}</h2>
          <p>Review visit details and closeout readiness.</p>
        </div>
        <div className="visit-detail-header-right">
          <button type="button" className="btn-primary" onClick={() => setShowEdit(true)}>
            Edit
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="alert-error">{error}</div>}
      {loading && !error && <div className="alert-info">Loading visit...</div>}

      {/* Visit Details */}
      {visit && (
        <div className="detail-card">
          <div className="card-header">
            <h3>Visit Details</h3>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item full-width">
                <span className="info-label">ID</span>
                <span className="info-value">{visit.id}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value">{visit.status}</span>
              </div>

              <div className="info-item full-width">
                <span className="info-label">Work Order</span>
                <span className="info-value">
                  <Link href={`/work-orders/${visit.workOrderId}`}>
                    {woLabel}
                  </Link>
                </span>
              </div>

              <div className="info-item">
                <span className="info-label">Scheduled</span>
                <span className="info-value">{formatDate(visit.scheduledFor)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Started</span>
                <span className="info-value">{formatDate(visit.startedAt)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Completed</span>
                <span className="info-value">{formatDate(visit.completedAt)}</span>
              </div>

              <div className="info-item full-width">
                <span className="info-label">Summary</span>
                <span className="info-value">{safe((visit as any).summary)}</span>
              </div>

              <div className="info-item full-width">
                <span className="info-label">Outcome</span>
                <span className="info-value">{safe((visit as any).outcome)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachments */}
      <AttachmentsPanel entityType="visit" entityId={visitId as string} />

      {/* Closeout Gate */}
      <div className="detail-card">
        <div className="card-header">
          <h3>Closeout Gate</h3>
          <button type="button" className="btn-secondary" onClick={fetchCloseoutGate}>
            Refresh
          </button>
        </div>
        <div className="card-body">
          {gateLoading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <span>Loading closeout gate...</span>
            </div>
          )}
          {gateError && <div className="alert-error">{gateError}</div>}
          {!gateLoading && !gateError && gateData && (
            <>
              <p className={gateData.canCloseout ? "closeout-ready" : "closeout-blocked"}>
                {gateData.canCloseout ? "Ready to closeout" : "Blocked"}
              </p>
              {gateData.blockers.length > 0 ? (
                <ul className="blockers-list">
                  {gateData.blockers.map((b, i) => (
                    <li key={`${b.message}-${i}`} className="blocker-item">
                      {b.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-blockers">No blockers.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && visit && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowEdit(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Visit</h3>
              <button type="button" className="modal-close" onClick={() => setShowEdit(false)} disabled={saving}>
                ✕
              </button>
            </div>

            <form onSubmit={saveVisit}>
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-field">
                    <label className="field-label">Status</label>
                    <select
                      className="field-select"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as VisitStatus)}
                    >
                      {Object.values(VisitStatus).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="field-label">Scheduled For</label>
                    <input
                      type="datetime-local"
                      className="field-input"
                      value={editScheduledFor}
                      onChange={(e) => setEditScheduledFor(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">Started At</label>
                    <input
                      type="datetime-local"
                      className="field-input"
                      value={editStartedAt}
                      onChange={(e) => setEditStartedAt(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">Completed At</label>
                    <input
                      type="datetime-local"
                      className="field-input"
                      value={editCompletedAt}
                      onChange={(e) => setEditCompletedAt(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">Summary</label>
                    <textarea
                      className="field-textarea"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">Outcome</label>
                    <textarea
                      className="field-textarea"
                      value={editOutcome}
                      onChange={(e) => setEditOutcome(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {saveError && <div className="save-error"><strong>Error:</strong> {saveError}</div>}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowEdit(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
