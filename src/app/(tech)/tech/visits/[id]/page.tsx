"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Visit } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type SingleResponse<T> = { data: T };

export default function TechVisitDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await apiFetch(`/api/visits/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Failed to load visit.");
        if (!cancelled) setVisit((json as SingleResponse<Visit>).data);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (!id) return <div className="card"><p>Missing visit id.</p></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Visit</h2>
          <p>Tech execution view.</p>
        </div>
        <Link className="link-button" href="/tech">← Back to My Work</Link>
      </div>

      {err && <div className="page-alert error">{err}</div>}
      {loading && !err && <div className="page-alert info">Loading…</div>}

      {visit && (
        <div className="card">
          <h3>{(visit as any).visitNumber ? `Visit ${(visit as any).visitNumber}` : "Visit"}</h3>
          <p className="muted">Status: {visit.status}</p>
          <AttachmentsPanel entityType="visit" entityId={visit.id} />
        </div>
      )}
    </div>
  );
}
