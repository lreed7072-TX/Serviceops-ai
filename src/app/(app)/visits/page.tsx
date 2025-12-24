 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Visit } from "@prisma/client";
import { apiFetch } from "@/lib/api";

type ListResponse<T> = {
  data?: T[];
};

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await apiFetch("/api/visits", { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load visits.");
        }
        const payload = (await response.json()) as ListResponse<Visit>;
        if (!cancelled) {
          setVisits(payload.data ?? []);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load visits.");
        setVisits([]);
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
        <h3>Today&apos;s visits</h3>
        {error && <p className="form-feedback error">{error}</p>}
        {loading ? (
          <p>Loading visits…</p>
        ) : visits.length === 0 ? (
          <p>No visits yet.</p>
        ) : (
          <ul className="task-list">
            {visits.map((visit) => (
              <li key={visit.id} className="task-item">
                <div className="task-meta-row">
                  <div>
                    <strong>Visit {visit.id.slice(0, 8)}</strong>
                    <p className="muted">Work order {visit.workOrderId}</p>
                  </div>
                  <Link className="link-button" href={`/visits/${visit.id}`}>
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
