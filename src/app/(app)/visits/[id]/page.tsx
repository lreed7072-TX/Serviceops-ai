"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Visit } from "@prisma/client";
import { z } from "zod";
import { apiFetch } from "@/lib/api";

type SingleResponse<T> = {
  data: T;
};

type CloseoutGateResponse = {
  data: {
    canCloseout: boolean;
    blockers: Array<{ message: string }>;
    summary?: {
      visitId: string;
    };
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

  const fetchCloseoutGate = useCallback(async () => {
    if (!visitId) return;
    setGateLoading(true);
    setGateError(null);
    try {
      const response = await apiFetch(`/api/visits/${visitId}/closeout-gate`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          throw new Error("Not found or no access.");
        }
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
          if (response.status === 403 || response.status === 404) {
            throw new Error("Not found or no access.");
          }
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load visit.");
        }
        const payload = (await response.json()) as SingleResponse<Visit>;
        if (!cancelled) {
          setVisit(payload.data);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load visit.");
        setVisit(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
    if (!parsedId.success) {
      return;
    }
    fetchCloseoutGate();
  }, [fetchCloseoutGate, visitId]);

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
        <Link className="link-button" href="/visits">
          ← Back to visits
        </Link>
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
            <p>
              {gateData.canCloseout ? "✅ Ready to closeout" : "❌ Blocked"}
            </p>
            {gateData.blockers.length > 0 ? (
              <ul className="task-list">
                {gateData.blockers.map((blocker, index) => (
                  <li key={`${blocker.message}-${index}`} className="task-item">
                    {blocker.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No blockers.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
