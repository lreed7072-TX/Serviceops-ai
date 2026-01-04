"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { TaskInstance, TaskStatus } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";

type SingleResponse<T> = { data: T };

export default function TechTaskPage() {
  const params = useParams();
  const search = useSearchParams();
  const taskId = params?.id as string | undefined;
  const workOrderId = search?.get("workOrderId") ?? null;

  const [task, setTask] = useState<TaskInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!taskId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.text()) || `Load failed (${res.status})`);
      const json = (await res.json()) as SingleResponse<TaskInstance>;
      setTask(json.data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load task.");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [taskId]);

  async function setStatus(next: TaskStatus) {
    if (!taskId) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Update failed (${res.status})`);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Task</h2>
          <p>Tech execution view.</p>
        </div>
        <Link className="link-button" href={workOrderId ? `/tech/work-orders/${workOrderId}?task=${taskId}` : "/tech"}>
          ← Back
        </Link>
      </div>

      {err ? <div className="page-alert error">{err}</div> : null}
      {loading && !err ? <div className="page-alert info">Loading…</div> : null}

      {task ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{task.title}</h3>
          {task.description ? <p>{task.description}</p> : null}
          <div className="muted" style={{ marginBottom: 12 }}>Status: {task.status}</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <button className="link-button" disabled={saving} onClick={() => setStatus("IN_PROGRESS" as any)}>Start</button>
            <button className="link-button" disabled={saving} onClick={() => setStatus("BLOCKED" as any)}>Block</button>
            <button className="link-button" disabled={saving} onClick={() => setStatus("DONE" as any)}>Done</button>
          </div>

          <h3 style={{ marginTop: 16 }}>Task attachments</h3>
          <AttachmentsPanel entityType="task" entityId={task.id} />

          <h3 style={{ marginTop: 16 }}>Evidence / Notes</h3>
          <p className="muted">
            Next step (we’ll wire this): Tech notes + photos go here, stored as attachments and/or task evidence.
          </p>
        </div>
      ) : null}
    </div>
  );
}
