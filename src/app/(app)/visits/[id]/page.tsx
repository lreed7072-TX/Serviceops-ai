"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Visit } from "@prisma/client";
import { VisitStatus } from "@prisma/client";
import { z } from "zod";
import { apiFetch } from "@/lib/api";

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

export default function VisitDetailPage() {
  const params = useParams();
  const visitId = params?.id as string | undefined;

  const [visit, setVisit] = useState<Visit | null>(null);
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

  const primeEdit = (v: Visit) => {
    setEditStatus((v.status ?? VisitStatus.PLANNED) as VisitStatus);
    setEditScheduledFor(v.scheduledFor ? new Date(v.scheduledFor as any).toISOString().slice(0, 16) : "");
    setEditStartedAt(v.startedAt ? new Date(v.startedAt as any).toISOString().slice(0, 16) : "");
    setEditCompletedAt(v.completedAt ? new Date(v.completedAt as any).toISOString().slice(0, 16) : "");
    setEditSummary((v.summary ?? "") as any);
    setEditOutcome((v.outcome ?? "") as any);
  };

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
      <div className="card">
        <p>Missing visit ID in URL.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Visit</h2>
          <p>Review visit details and closeout readiness.</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" className="link-button" onClick={() => setShowEdit(true)}>
            Edit
          </button>
          <Link className="link-button" href="/visits">
            ← Back to visits
          </Link>
        </div>
      </div>

      {error && <div className="page-alert error">{error}</div>}
      {loading && !error && <div className="page-alert info">Loading visit…</div>}

      {visit && (
        <div className="card">
          <h3>Visit details</h3>
          <dl className="detail-grid">
            <div>
              <dt>ID</dt>
              <dd>{visit.id}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{visit.status}</dd>
            </div>
            <div>
              <dt>Work order</dt>
              <dd>{visit.workOrderId}</dd>
            </div>
            <div>
              <dt>Scheduled</dt>
              <dd>{formatDate(visit.scheduledFor)}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{formatDate(visit.startedAt)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatDate(visit.completedAt)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Closeout Gate</h3>
          <button type="button" className="link-button" onClick={fetchCloseoutGate}>
            Refresh
          </button>
        </div>

        {gateLoading && <p>Loading closeout gate…</p>}
        {gateError && <p className="form-feedback error">{gateError}</p>}
        {!gateLoading && !gateError && gateData && (
          <>
            <p>{gateData.canCloseout ? "✅ Ready to closeout" : "❌ Blocked"}</p>
            {gateData.blockers.length > 0 ? (
              <ul className="task-list">
                {gateData.blockers.map((b, i) => (
                  <li key={`${b.message}-${i}`} className="task-item">
                    {b.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No blockers.</p>
            )}
          </>
        )}
      </div>

      {showEdit && visit && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowEdit(false);
          }}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: 16,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Edit Visit</h3>
              <button type="button" className="link-button" onClick={() => setShowEdit(false)} disabled={saving}>
                Close
              </button>
            </div>

            <form onSubmit={saveVisit} style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as VisitStatus)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                >
                  {Object.values(VisitStatus).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Scheduled for</span>
                <input
                  type="datetime-local"
                  value={editScheduledFor}
                  onChange={(e) => setEditScheduledFor(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Started at</span>
                <input
                  type="datetime-local"
                  value={editStartedAt}
                  onChange={(e) => setEditStartedAt(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Completed at</span>
                <input
                  type="datetime-local"
                  value={editCompletedAt}
                  onChange={(e) => setEditCompletedAt(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Summary</span>
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={3}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Outcome</span>
                <textarea
                  value={editOutcome}
                  onChange={(e) => setEditOutcome(e.target.value)}
                  rows={3}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                  }}
                />
              </label>

              {saveError && (
                <div style={{ padding: 12, border: "1px solid rgba(255,0,0,0.25)", borderRadius: 10 }}>
                  <strong>Error:</strong> {saveError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="link-button" onClick={() => setShowEdit(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
