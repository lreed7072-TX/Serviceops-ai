"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Visit, WorkOrder } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";

type ListResponse<T> = { data?: T[] };

export default function TechHomePage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const [woRes, vRes] = await Promise.all([
          apiFetch("/api/work-orders", { cache: "no-store" }),
          apiFetch("/api/visits", { cache: "no-store" }),
        ]);

        if (!woRes.ok) throw new Error(`Work orders failed (${woRes.status})`);
        if (!vRes.ok) throw new Error(`Visits failed (${vRes.status})`);

        const woJson = (await woRes.json()) as ListResponse<WorkOrder>;
        const vJson = (await vRes.json()) as ListResponse<Visit>;

        if (cancelled) return;

        setWorkOrders(Array.isArray(woJson.data) ? woJson.data : []);
        setVisits(Array.isArray(vJson.data) ? vJson.data : []);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "Failed to load.");
        setWorkOrders([]);
        setVisits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (d?: string | Date | null) => {
    if (!d) return "—";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString();
  };

  return (
    <div>
      <PageHeader
        title="My Work"
        subtitle="Assigned work orders and visits."
        right={<Badge>Tech</Badge>}
      />

      {err ? <div className="page-alert error">{err}</div> : null}
      {loading && !err ? <div className="page-alert info">Loading…</div> : null}

      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <CardHeader>
            <h3 style={{ margin: 0 }}>Assigned work orders</h3>
          </CardHeader>
          <div style={{ padding: 14 }}> 
            {workOrders.length === 0 ? (
              <p className="muted">No assigned work orders yet.</p>
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
                      <td>{(wo as any).workOrderNumber ?? "—"}</td>
                      <td>{wo.title}</td>
                      <td>{wo.status}</td>
                      <td>
                        <Link className="link-button" href={`/tech/work-orders/${wo.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h3 style={{ margin: 0 }}>Assigned visits</h3>
          </CardHeader>
          <div style={{ padding: 14 }}> 
            {visits.length === 0 ? (
              <p className="muted">No assigned visits yet.</p>
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
                      <td>{(v as any).visitNumber ?? v.id.slice(0, 8)}</td>
                      <td>{v.status}</td>
                      <td>{fmt((v as any).scheduledFor)}</td>
                      <td>
                        <Link className="link-button" href={`/tech/visits/${v.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
