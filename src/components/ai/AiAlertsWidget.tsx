"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import "./AiAlertsWidget.css";

interface AiInsight {
  id: string;
  insightType: string;
  severity: "HIGH" | "CRITICAL";
  title: string;
  summary: string;
  confidence: number;
  entityType: string;
  entityId: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

function entityDetailPath(entityType: string, entityId: string): string {
  switch (entityType) {
    case "Asset":
      return `/assets/${entityId}`;
    case "WorkOrder":
      return `/work-orders/${entityId}`;
    case "PmSchedule":
      return `/pm-schedules/${entityId}`;
    case "Site":
      return `/sites/${entityId}`;
    default:
      return "#";
  }
}

export default function AiAlertsWidget() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [highRes, criticalRes] = await Promise.all([
          apiFetch("/api/ai/insights?severity=HIGH&activeOnly=true"),
          apiFetch("/api/ai/insights?severity=CRITICAL&activeOnly=true"),
        ]);

        const highData = highRes.ok ? (await highRes.json()).data ?? [] : [];
        const critData = criticalRes.ok ? (await criticalRes.json()).data ?? [] : [];

        if (!cancelled) {
          // Combine, dedupe by id, sort critical first then by date
          const combined: AiInsight[] = [...critData, ...highData];
          const seen = new Set<string>();
          const unique = combined.filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          });

          // Sort: CRITICAL first, then by createdAt desc
          unique.sort((a, b) => {
            if (a.severity === "CRITICAL" && b.severity !== "CRITICAL") return -1;
            if (b.severity === "CRITICAL" && a.severity !== "CRITICAL") return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });

          setAlerts(unique.slice(0, 10));
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  return (
    <div className="ai-alerts-widget">
      <div className="ai-alerts-widget-header">
        <h3>
          <span className="ai-alerts-icon">!</span>
          AI Alerts
          {alerts.length > 0 && (
            <span className="ai-alerts-count-badge">{alerts.length}</span>
          )}
        </h3>
      </div>

      {alerts.length === 0 ? (
        <div className="ai-alerts-empty">
          <div className="ai-alerts-empty-icon">&#10003;</div>
          All clear &mdash; no critical AI alerts
        </div>
      ) : (
        <div className="ai-alerts-list">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="ai-alert-item"
              onClick={() => router.push(entityDetailPath(alert.entityType, alert.entityId))}
            >
              <div className={`ai-alert-severity-icon ${alert.severity.toLowerCase()}`}>
                {alert.severity === "CRITICAL" ? "!!" : "!"}
              </div>
              <div className="ai-alert-content">
                <div className="ai-alert-title">{alert.title}</div>
                <div className="ai-alert-entity">
                  {alert.entityType} &middot; {alert.insightType}
                </div>
              </div>
              <div className="ai-alert-time">
                {timeAgo(alert.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
