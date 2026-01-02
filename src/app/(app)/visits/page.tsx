"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Visit, WorkOrder } from "@prisma/client";

type UserLite = { id: string; email: string; name?: string | null; role?: string | null };
import { VisitStatus } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";


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
  const [users, setUsers] = useState<UserLite[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create Visit form state
  const [workOrderId, setWorkOrderId] = useState("");
  const [status, setStatus] = useState<VisitStatus>(VisitStatus.PLANNED);
  const [scheduledFor, setScheduledFor] = useState(""); // datetime-local string
  const [assignedTechId, setAssignedTechId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const workOrderLookup = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    workOrders.forEach((wo) => map.set(wo.id, wo));
    return map;
  }, [workOrders]);

  const load = async () => {
    try {
      setLoading(true);
      const [visitData, woData, userData] = await Promise.all([
        fetchList<Visit>("/api/visits"),
        fetchList<WorkOrder>("/api/work-orders"),
        fetchList<UserLite>("/api/users"),
      ]);
      setVisits(visitData);
      setWorkOrders(woData);
      setUsers(userData);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : "Failed to load visits.");
      setVisits([]);
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [visitData, woData, userData] = await Promise.all([
          fetchList<Visit>("/api/visits"),
          fetchList<WorkOrder>("/api/work-orders"),
          fetchList<UserLite>("/api/users"),
        ]);
        if (cancelled) return;
        setVisits(visitData);
        setWorkOrders(woData);
        setUsers(userData);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setLoadError(err instanceof Error ? err.message : "Failed to load visits.");
        setVisits([]);
        setWorkOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const canCreate = workOrderId.trim().length > 0 && !creating;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!workOrderId.trim()) {
      setCreateError("Work order is required.");
      return;
    }

    try {
      setCreating(true);

      const res = await apiFetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId,
          status,
          assignedTechId: assignedTechId.trim() || null,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        }),
      });

      if (!res.ok) {
        let detail: string | undefined;
        try {
          const payload = (await res.json()) as { error?: string };
          detail = payload.error;
        } catch {}
        throw new Error(detail ?? `Failed to create visit (${res.status}).`);
      }

      const payload = (await res.json()) as { data?: any };
      const createdNumber = payload?.data?.visitNumber ?? null;

      setCreateSuccess(createdNumber ? `Created ${createdNumber}.` : "Visit created.");
      setWorkOrderId("");
      setStatus(VisitStatus.PLANNED);
      setScheduledFor("");
      setAssignedTechId("");

      await load();
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create visit.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
            <PageHeader
        title="Visit Execution"
        subtitle="Track arrival, checklist completion, and closeout status."
        right={
          <>
            <Badge>Tech workflow</Badge>
          </>
        }
      />

      <div className="card">
        <h3>Create visit</h3>

        <form className="form-grid" onSubmit={handleCreate}>
          <label className="form-field">
            <span>Work order</span>
            <select
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              disabled={loading || creating}
              required
            >
              <option value="">Select a work order</option>
              {workOrders.map((wo) => {
                const woNumber = (wo as any).workOrderNumber ?? "WO—";
                return (
                  <option key={wo.id} value={wo.id}>
                    {woNumber} — {wo.title}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="form-field">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VisitStatus)}
              disabled={loading || creating}
            >
              {Object.values(VisitStatus).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Technician</span>
            <select
              value={assignedTechId}
              onChange={(e) => setAssignedTechId(e.target.value)}
              disabled={loading || creating}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.name && u.name.trim().length ? u.name : u.email) + (u.role ? ` (${u.role})` : "")}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Scheduled for</span>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              disabled={loading || creating}
            />
          </label>

          {createError && <p className="form-feedback error">{createError}</p>}
          {createSuccess && <p className="form-feedback success">{createSuccess}</p>}

          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" disabled={!canCreate}>
              {creating ? "Creating…" : "Create visit"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Visits</h3>
          <button type="button" className="link-button" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>

        {loadError && <p className="form-feedback error">{loadError}</p>}

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

              const visitLabel = (visit as any).visitNumber ?? shortId(visit.id);

              return (
                <li key={visit.id} className="task-item">
                  <div className="task-meta-row">
                    <div>
                      <strong>Visit {visitLabel}</strong>
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
