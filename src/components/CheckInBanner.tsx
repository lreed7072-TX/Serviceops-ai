"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCheckIn } from "@/contexts/CheckInContext";
import { apiFetch } from "@/lib/api";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getDurationColor(seconds: number): string {
  const hours = seconds / 3600;
  if (hours >= 12) return "cib-danger";
  if (hours >= 8) return "cib-warning";
  return "cib-normal";
}

export function CheckInBanner() {
  const { activeCheckIn, loading, refreshCheckIn } = useCheckIn();
  const [elapsed, setElapsed] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!activeCheckIn) {
      setElapsed(0);
      return;
    }
    const checkInTime = new Date(activeCheckIn.checkInAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - checkInTime) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeCheckIn]);

  if (loading || !activeCheckIn) return null;

  const handleCheckOut = async () => {
    setCheckingOut(true);
    try {
      const res = await apiFetch(`/api/work-orders/${activeCheckIn.workOrderId}/check-out`, {
        method: "POST",
      });
      if (res.ok) {
        await refreshCheckIn();
      }
    } catch (e) {
      console.error("Check-out failed:", e);
    } finally {
      setCheckingOut(false);
    }
  };

  const colorClass = getDurationColor(elapsed);
  const siteName = activeCheckIn.site?.name ?? "Site";
  const woLabel = activeCheckIn.workOrder.workOrderNumber ?? activeCheckIn.workOrder.title;

  return (
    <div className={`cib-banner ${colorClass}`}>
      <div className="cib-content">
        <div className="cib-dot" />
        <div className="cib-info">
          <Link href={`/tech/work-orders/${activeCheckIn.workOrderId}`} className="cib-link">
            <strong>{siteName}</strong>
            <span className="cib-separator">·</span>
            <span className="cib-wo">{woLabel}</span>
          </Link>
        </div>
        <div className="cib-timer">{formatDuration(elapsed)}</div>
        <button
          className="cib-checkout-btn"
          onClick={handleCheckOut}
          disabled={checkingOut}
        >
          {checkingOut ? "..." : "Check Out"}
        </button>
      </div>
    </div>
  );
}
