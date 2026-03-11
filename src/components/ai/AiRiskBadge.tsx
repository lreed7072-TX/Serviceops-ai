"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import "./AiRiskBadge.css";

interface AiInsight {
  id: string;
  insightType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  summary: string;
  confidence: number;
  actionRecommended: string | null;
  details: Record<string, unknown> | null;
  acknowledgedAt: string | null;
}

interface AiRiskBadgeProps {
  entityType: string;
  entityId: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const SEVERITY_LABEL: Record<string, string> = {
  LOW: "OK",
  MEDIUM: "Monitor",
  HIGH: "Warning",
  CRITICAL: "Critical",
};

export default function AiRiskBadge({ entityType, entityId }: AiRiskBadgeProps) {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!entityType || !entityId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await apiFetch(
          `/api/ai/insights?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&activeOnly=true`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setInsights(Array.isArray(json.data) ? json.data : []);
        }
      } catch {
        // Silently fail — badge is non-critical UI
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  if (!loaded || insights.length === 0) return null;

  // Find highest severity
  const highest = insights.reduce((max, ins) =>
    (SEVERITY_ORDER[ins.severity] ?? 0) > (SEVERITY_ORDER[max.severity] ?? 0) ? ins : max
  , insights[0]);

  const severityClass = highest.severity.toLowerCase();
  const label = SEVERITY_LABEL[highest.severity] ?? highest.severity;

  return (
    <span className={`ai-risk-badge ${severityClass}`}>
      <span className="ai-risk-dot" />
      {label}
      <span className="ai-risk-tooltip">
        {insights.length} AI insight{insights.length !== 1 ? "s" : ""} active
      </span>
    </span>
  );
}
