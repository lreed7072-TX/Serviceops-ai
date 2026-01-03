"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Visit } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type SingleResponse<T> = { data: T };

type CloseoutGateResponse = {
  data: {
    canCloseout: boolean;
    blockers: Array<{ message: string }>;
  };
};

const fmt = (v?: string | Date | null) => {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

export default function TechVisitDetailPage() {
  const params = useParams();
  const visitId = params?.id as string | undefined;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [gate, setGate] = useState<CloseoutGateResponse["data"] | null>(null);
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(false);

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await apiFetch(`/api/visits/${visitId}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json())?.error ?? "Failed to load visit.");
        const payload = (await res.json()) as SingleResponse<Visit>;
        if (cancelled) return;
        setVisit(payload.data);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load visit.");
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

  const refreshGate = useCallback(async () => {
    if (!visitId) return;
    setGateLoading(true);
    setGateErr(null);
    try {
      const res = await apiFetch(`/api/visits/${visitId}/closeout-gate`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Failed to load closeout gate.");
      const payload = (await res.json()) as CloseoutGateResponse;
      setGate(payload.data);
    } catch (e: any) {
      setGateErr(e?.message ?? "Failed to load closeout gate.");
      setGate(null);
    } finally {
      setGateLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    refreshGate();
  }, [refreshGate]);

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
          <p>Tech visit view (attachments + closeout gate).</p>
        </div>
        <Link className="link-button" href="/tech">
          ← Back to My Work
        </Link>
      </div>

      {err && <div className="page-alert error">{err}</div>}
      {loading && !err && <div className="page-alert info">Loading…</div>}

      {visit ? (
        <>
          <div className="card">
            <h3>
              {(visit as any).visitNumber ? `${(visit as any).visitNumber} — ` : ""}
              Visit details
            </h3>

            <dl className="detail-grid">
              <div>
                <dt>Status</dt>
                <dd>{visit.status}</dd>
              </div>
              <div>
                <dt>Scheduled</dt>
                <dd>{fmt(visit.scheduledFor)}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{fmt(visit.startedAt)}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{fmt(visit.completedAt)}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Work order</dt>
                <dd>{visit.workOrderId}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Summary</dt>
                <dd>{visit.summary ?? "—"}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Outcome</dt>
                <dd>{visit.outcome ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <AttachmentsPanel entityType="visit" entityId={visit.id} />

          <div className="card">
            <div className="card-header">
              <h3>Closeout Gate</h3>
              <button type="button" className="link-button" onClick={refreshGate}>
                Refresh
              </button>
            </div>

            {gateLoading ? <p>Loading…</p> : null}
            {gateErr ? <p className="form-feedback error">{gateErr}</p> : null}
            {gate && !gateLoading && !gateErr ? (
              <>
                <p>{gate.canCloseout ? "✅ Ready to closeout" : "❌ Blocked"}</p>
                {gate.blockers.length ? (
                  <ul className="task-list">
                    {gate.blockers.map((b, i) => (
                      <li key={`${b.message}-${i}`} className="task-item">
                        {b.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No blockers.</p>
                )}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
