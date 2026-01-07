"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { SignaturePad } from "@/components/SignaturePad";

type WorkOrderData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  workOrderNumber: string | null;
  executionMode: string;
  createdAt: string;
  customer?: { id: string; name: string };
  site?: { id: string; name: string; address: string | null; city: string | null; state: string | null };
  asset?: { id: string; name: string; manufacturer: string | null; model: string | null; serialNumber: string | null };
};

type PackageData = { id: string; name: string; packageType: string; status: string; };
type TaskData = { id: string; title: string; description: string | null; status: string; isCritical: boolean; workPackageId: string; };
type TimerData = { id: string; status: "RUNNING" | "PAUSED" | "STOPPED"; taskInstanceId: string | null; currentSeconds: number; };
type SignatureData = {
  id: string;
  signatureType: "CUSTOMER" | "TECH" | "WITNESS";
  signerName: string;
  signerTitle: string | null;
  signatureData: string;
  signedAt: string;
  capturedBy?: { name: string | null; email: string };
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function TechWorkOrderPage() {
  const params = useParams();
  const workOrderId = params?.id as string | undefined;

  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [signatures, setSignatures] = useState<SignatureData[]>([]);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  // Signature capture state
  const [showSignaturePad, setShowSignaturePad] = useState<"CUSTOMER" | "TECH" | "WITNESS" | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);

  const loadTimer = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tech/timer", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTimer(json.data);
        if (json.data) setDisplaySeconds(json.data.currentSeconds);
      }
    } catch (e) { console.error(e); }
  }, []);

  const loadSignatures = useCallback(async () => {
    if (!workOrderId) return;
    try {
      const res = await apiFetch(`/api/work-orders/${workOrderId}/signatures`, { cache: "no-store" });
      if (res.ok) setSignatures((await res.json()).data ?? []);
    } catch (e) { console.error(e); }
  }, [workOrderId]);

  useEffect(() => {
    if (!workOrderId) return;
    (async () => {
      try {
        setLoading(true);
        const [woRes, pkgRes, taskRes] = await Promise.all([
          apiFetch(`/api/work-orders/${workOrderId}`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/packages`, { cache: "no-store" }),
          apiFetch(`/api/work-orders/${workOrderId}/tasks`, { cache: "no-store" }),
        ]);
        if (!woRes.ok) throw new Error("Failed to load work order");
        setWorkOrder((await woRes.json()).data);
        setPackages(pkgRes.ok ? (await pkgRes.json()).data ?? [] : []);
        setTasks(taskRes.ok ? (await taskRes.json()).data ?? [] : []);
        await loadTimer();
        await loadSignatures();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [workOrderId, loadTimer, loadSignatures]);

  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;
    const interval = setInterval(() => setDisplaySeconds((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleSaveSignature = async (dataUrl: string) => {
    if (!workOrderId || !showSignaturePad) return;
    setSavingSignature(true);
    try {
      const res = await apiFetch(`/api/work-orders/${workOrderId}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureType: showSignaturePad,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim() || null,
          signatureData: dataUrl,
        }),
      });
      if (!res.ok) throw new Error("Failed to save signature");
      setShowSignaturePad(null);
      setSignerName("");
      setSignerTitle("");
      await loadSignatures();
    } catch (e: any) {
      setErr(e?.message);
    } finally {
      setSavingSignature(false);
    }
  };

  const handleDeleteSignature = async (id: string) => {
    if (!workOrderId || !confirm("Delete this signature?")) return;
    try {
      await apiFetch(`/api/work-orders/${workOrderId}/signatures/${id}`, { method: "DELETE" });
      await loadSignatures();
    } catch (e: any) {
      setErr(e?.message);
    }
  };

  // Group and sort tasks
  const tasksByPackage: Record<string, TaskData[]> = {};
  tasks.forEach((t) => {
    if (!tasksByPackage[t.workPackageId]) tasksByPackage[t.workPackageId] = [];
    tasksByPackage[t.workPackageId].push(t);
  });
  Object.values(tasksByPackage).forEach((arr) => {
    const order: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, BLOCKED: 2, DONE: 3, SKIPPED: 4 };
    arr.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (!workOrderId) return <div className="tech-container"><p>Missing work order ID.</p></div>;

  return (
    <div className="tech-container">
      <div className="tech-header">
        <Link href="/tech" className="tech-back">← Back</Link>
        <h1>Work Order</h1>
      </div>

      {err && <div className="tech-alert error">{err}</div>}
      {loading && <div className="tech-alert info">Loading…</div>}

      {workOrder && (
        <>
          <div className="tech-card">
            <div className="tech-card-header">
              <div>
                <div className="wo-number">{workOrder.workOrderNumber || "Work Order"}</div>
                <h2 style={{ margin: 0 }}>{workOrder.title}</h2>
              </div>
              <span className={`tech-status ${workOrder.status.toLowerCase()}`}>{workOrder.status.replace("_", " ")}</span>
            </div>
            {workOrder.description && <p className="tech-description">{workOrder.description}</p>}
            <div className="wo-meta"><span>Created: {formatDate(workOrder.createdAt)}</span></div>
          </div>

          <div className="tech-card">
            <h3>Location Details</h3>
            <div className="info-grid">
              {workOrder.customer && <div className="info-row"><span className="info-label">Customer</span><span className="info-value">{workOrder.customer.name}</span></div>}
              {workOrder.site && (
                <>
                  <div className="info-row"><span className="info-label">Site</span><span className="info-value">{workOrder.site.name}</span></div>
                  {(workOrder.site.address || workOrder.site.city) && (
                    <div className="info-row"><span className="info-label">Address</span><span className="info-value">{[workOrder.site.address, workOrder.site.city, workOrder.site.state].filter(Boolean).join(", ")}</span></div>
                  )}
                </>
              )}
              {workOrder.asset && (
                <>
                  <div className="info-row"><span className="info-label">Asset</span><span className="info-value">{workOrder.asset.name}</span></div>
                  {(workOrder.asset.manufacturer || workOrder.asset.model) && <div className="info-row"><span className="info-label">Equipment</span><span className="info-value">{[workOrder.asset.manufacturer, workOrder.asset.model].filter(Boolean).join(" ")}</span></div>}
                  {workOrder.asset.serialNumber && <div className="info-row"><span className="info-label">Serial #</span><span className="info-value">{workOrder.asset.serialNumber}</span></div>}
                </>
              )}
            </div>
          </div>

          <div className="tech-card">
            <h3>Progress</h3>
            <div className="progress-bar-container"><div className="progress-bar" style={{ width: `${progressPercent}%` }} /></div>
            <div className="progress-stats"><span>{completedTasks} of {totalTasks} tasks complete</span><span>{progressPercent}%</span></div>
            {inProgressTasks > 0 && <div className="progress-note">{inProgressTasks} task{inProgressTasks > 1 ? "s" : ""} in progress</div>}
          </div>

          {packages.map((pkg) => {
            const pkgTasks = tasksByPackage[pkg.id] ?? [];
            const completedCount = pkgTasks.filter((t) => t.status === "DONE").length;
            return (
              <div key={pkg.id} className="tech-card">
                <div className="package-header">
                  <h3 style={{ margin: 0 }}>{pkg.name}</h3>
                  <span className="package-progress">{completedCount}/{pkgTasks.length} done</span>
                </div>
                {pkgTasks.length === 0 ? <p className="muted">No tasks.</p> : (
                  <ul className="tech-list">
                    {pkgTasks.map((t) => {
                      const isTimerOnThis = timer?.taskInstanceId === t.id && timer.status !== "STOPPED";
                      return (
                        <li key={t.id} className="tech-list-item">
                          <div className="tech-list-item-content">
                            <div className="tech-list-item-title">
                              {t.title}
                              {t.isCritical && <span className="tech-badge critical">Critical</span>}
                              {isTimerOnThis && timer?.status === "RUNNING" && <span className="timer-indicator running">{formatTime(displaySeconds)}</span>}
                              {isTimerOnThis && timer?.status === "PAUSED" && <span className="timer-indicator paused">Paused</span>}
                            </div>
                            <div className="tech-list-item-meta"><span className={`tech-status ${t.status.toLowerCase()}`}>{t.status.replace("_", " ")}</span></div>
                          </div>
                          <div className="tech-list-item-action">
                            <Link href={`/tech/tasks/${t.id}`} className="tech-btn primary">{t.status === "DONE" ? "View" : "Open"}</Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          <div className="tech-card">
            <h3>Work Order Attachments</h3>
            <AttachmentsPanel entityType="workOrder" entityId={workOrderId} />
          </div>

          {/* Signatures Section */}
          <div className="tech-card signatures-section">
            <h3>Signatures</h3>
            
            {signatures.length > 0 && (
              <div className="signatures-list">
                {signatures.map((sig) => (
                  <div key={sig.id} className="signature-item">
                    <img src={sig.signatureData} alt={`${sig.signerName} signature`} className="signature-image" />
                    <div className="signature-info">
                      <span className={`signature-type ${sig.signatureType.toLowerCase()}`}>{sig.signatureType}</span>
                      <strong>{sig.signerName}</strong>
                      {sig.signerTitle && <span className="muted">{sig.signerTitle}</span>}
                      <div className="signature-meta">{formatDateTime(sig.signedAt)}</div>
                    </div>
                    <button className="btn-icon danger" onClick={() => handleDeleteSignature(sig.id)}>🗑️</button>
                  </div>
                ))}
              </div>
            )}

            {!showSignaturePad && (
              <div className="add-signature-buttons">
                <button className="btn btn-outline" onClick={() => { setShowSignaturePad("CUSTOMER"); setSignerName(""); setSignerTitle(""); }}>+ Customer Signature</button>
                <button className="btn btn-outline" onClick={() => { setShowSignaturePad("TECH"); setSignerName(""); setSignerTitle(""); }}>+ Tech Signature</button>
              </div>
            )}

            {showSignaturePad && (
              <SignaturePad
                signatureType={showSignaturePad}
                signerName={signerName}
                setSignerName={setSignerName}
                signerTitle={signerTitle}
                setSignerTitle={setSignerTitle}
                onSave={handleSaveSignature}
                onCancel={() => setShowSignaturePad(null)}
                saving={savingSignature}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
