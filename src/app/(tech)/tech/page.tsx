"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";

type ListResponse<T> = { data?: T[] };

type WorkOrderRow = {
  id: string;
  title: string;
  status: string;
  workOrderNumber?: string | null;
  updatedAt: string;
};

type VisitRow = {
  id: string;
  visitNumber?: string | null;
  status: string;
  scheduledFor?: string | null;
  workOrderId: string;
  updatedAt: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  isCritical: boolean;
  updatedAt: string;
  workOrder: { id: string; title: string; workOrderNumber?: string | null };
  workPackage: { id: string; name: string };
};

async function fetchList<T>(path: string): Promise<T[]> {
  const res = await fetch(path, { cache: "no-store", credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  const json = (await res.json()) as ListResponse<T>;
  return json.data ?? [];
}

export default function TechHomePage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // NOTE: These endpoints are already RBAC-filtered to "assigned only" for TECH in your API.
        const [wo, v, t] = await Promise.all([
          fetchList<WorkOrderRow>("/api/work-orders"),
          fetchList<VisitRow>("/api/visits"),
          fetchList<TaskRow>("/api/tech/tasks"),
        ]);

        if (!active) return;
        setWorkOrders(wo);
        setVisits(v);
        setTasks(t);
      } catch (e: any) {
        if (!active) return;
        setErr(e?.message ?? "Failed to load tech dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const openTasks = useMemo(() => {
    // Put DONE at bottom
    return [...tasks].sort((a, b) => {
      const aDone = a.status === "DONE";
      const bDone = b.status === "DONE";
      if (aDone !== bDone) return aDone ? 1 : -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [tasks]);

  return (
    <div>
      <PageHeader
        title="My Work"
        subtitle="Assigned work orders, visits, and tasks."
        right={<Badge>Tech</Badge>}
      />

      {err ? <div className="page-alert error">{err}</div> : null}
      {loading && !err ? <div className="page-alert info">Loading…</div> : null}

      <Card>
        <CardHeader>
          <h3>Assigned work orders</h3>
        </CardHeader>

        {loading ? (
          <p>Loading…</p>
        ) : workOrders.length === 0 ? (
          <p className="muted">No work orders assigned yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>WO #</th>
                <th>Title</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr key={wo.id}>
                  <td>{wo.workOrderNumber ?? "—"}</td>
                  <td>{wo.title}</td>
                  <td>{wo.status}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="link-button" href={`/work-orders/${wo.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div style={{ height: 12 }} />

      <Card>
        <CardHeader>
          <h3>Assigned tasks</h3>
        </CardHeader>

        {loading ? (
          <p>Loading…</p>
        ) : openTasks.length === 0 ? (
          <p className="muted">No tasks assigned yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>WO</th>
                <th>Task</th>
                <th>Status</th>
                <th>Package</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {openTasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>
                      {t.workOrder.workOrderNumber ?? "—"}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {t.workOrder.title}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>{t.title}</span>
                      {t.isCritical ? <span className="task-chip">Critical</span> : null}
                    </div>
                  </td>
                  <td>{t.status}</td>
                  <td>{t.workPackage?.name ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="link-button" href={`/work-orders/${t.workOrder.id}`}>
                      Open WO
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div style={{ height: 12 }} />

      <Card>
        <CardHeader>
          <h3>Assigned visits</h3>
        </CardHeader>

        {loading ? (
          <p>Loading…</p>
        ) : visits.length === 0 ? (
          <p className="muted">No visits assigned yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Visit #</th>
                <th>Status</th>
                <th>Scheduled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>{v.visitNumber ?? v.id.slice(0, 8)}</td>
                  <td>{v.status}</td>
                  <td>{v.scheduledFor ? new Date(v.scheduledFor).toLocaleString() : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link className="link-button" href={`/visits/${v.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
