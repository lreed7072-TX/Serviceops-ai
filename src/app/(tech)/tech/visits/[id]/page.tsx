"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Visit } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type SingleResponse<T> = { data: T };

export default function TechVisitPage() {
  const params = useParams();
  const visitId = params?.id as string | undefined;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await apiFetch(`/api/visits/${visitId}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.text()) || `Load failed (${res.status})`);
        const json = (await res.json()) as SingleResponse<Visit>;
        if (!cancelled) setVisit(json.data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load visit.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visitId]);

  if (!visitId) return <div className="card"><p>Missing visit ID.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Visit</h2>
          <p>Tech execution view.</p>
        </div>
        <Link className="link-button" href="/tech">← Back to My Work</Link>
      </div>

      {err ? <div className="page-alert error">{err}</div> : null}
      {loading && !err ? <div className="page-alert info">Loading…</div> : null}

      {visit ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{(visit as any).visitNumber ?? "Visit"} — {visit.status}</h3>
          <div className="muted">WorkOrder: {visit.workOrderId}</div>

          <h3 style={{ marginTop: 16 }}>Visit attachments</h3>
          <AttachmentsPanel entityType="visit" entityId={visit.id} />
        </div>
      ) : null}
    </div>
  );
}
