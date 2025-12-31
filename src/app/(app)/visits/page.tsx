"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Visit, WorkOrder } from "@prisma/client";
import { apiFetch } from "@/lib/api";

type ListResponse<T> = { data?: T[] };

async function fetchList<T>(path: string): Promise<T[]> {
  const res = await apiFetch(path, { cache: "no-store" });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const payload = (await res.json()) as { error?: string };
      detail = payload.error;
    } catch {}
    throw new Error(detail ?? `Request to ${path} failed with ${res.status}`);
  }
  const payload = (await res.json()) as ListResponse<T>;
  return payload.data ?? [];
}

const shortId = (id: string) => (id ? id.slice(0, 8) : "—");

const formatDate = (value?: string | Date | null) => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const workOrderLookup = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    workOrders.forEach((wo) => map.set(wo.id, wo));
    return map;
  }, [workOrders]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [visitData, woData] = await Promise.all([
          fetchList<Visit>("/api/visits"),
          fetchList<WorkOrder>("/api/work-orders"),
        ]);
        if (cancelled) return;

        setVisits(visitData);
        setWorkOrders(woData);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load visits.");
        setVisits([]);
        setWorkOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Visit Execution</h2>
          <p>Track arrival, checklist completion, and closeout status.</p>
        </div>
        <span className="badge">Tech workflow</span>
      </div>

      <div className="card">
        <h3>Today's visits</h3>
        {error && <p className="form-feedback error">{error}</p>}

        {loading ? (
          <p>Loading visits…</p>
        ) : visits.length === 0 ? (
          <p>No visits yet.</p>
        ) : (
          <ul className="task-list">
            {visits.map((visit) => {
              const wo = workOrderLookup.get(visit.workOrderId);
              const woNumber = (wo as any)?.workOrderNumber ?? "WO—";
              const woTitle = wo?.title ?? `Work order ${shortId(visit.workOrderId)}…`;
              const woLabel = wo ? `${woNumber} — ${woTitle}` : woTitle;

              const when =
                (visit as any).scheduledFor
                  ? ` • Scheduled ${formatDate((visit as any).scheduledFor)}`
                  : "";

              const summary = ((visit as any).summary ?? "").toString().trim();
              const summarySnippet =
                summary.length > 0 ? (summary.length > 90 ? summary.slice(0, 90) + "…" : summary) : "";

              return (
                <li key={visit.id} className="task-item">
                  <div className="task-meta-row">
                    <div>
                      <strong>Visit {(visit as any).visitNumber ?? shortId(visit.id)}</strong>
                      <p className="muted">
                        <Link className="link-button" href={`/work-orders/${visit.workOrderId}`}>
                          {woLabel}
                        </Link>
                      </p>
                      <p className="muted">
                        {(visit as any).status ?? "—"}
                        {when}
                      </p>
                      {summarySnippet ? <p className="muted">Summary: {summarySnippet}</p> : null}
                    </div>
                    <Link className="link-button" href={`/visits/${visit.id}`}>
                      View
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
