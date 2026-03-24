"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import "./AiSuggestedTechBadge.css";

interface AiInsight {
  id: string;
  insightType: string;
  title: string;
  summary: string;
  confidence: number;
  details: Record<string, unknown> | null;
}

interface AiSuggestedTechBadgeProps {
  entityId: string;
}

export default function AiSuggestedTechBadge({ entityId }: AiSuggestedTechBadgeProps) {
  const [suggestion, setSuggestion] = useState<{
    techName: string;
    reason: string;
    confidence: number;
    insightId: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await apiFetch(
          `/api/ai/insights?entityType=WorkOrder&entityId=${encodeURIComponent(entityId)}&insightType=SCHEDULING_RECOMMENDATION&activeOnly=true`
        );
        if (!res.ok) return;
        const json = await res.json();
        const insights: AiInsight[] = Array.isArray(json.data) ? json.data : [];

        if (!cancelled && insights.length > 0) {
          const insight = insights[0];
          const details = insight.details as Record<string, unknown> | null;
          const techName =
            (details?.recommendedTechName as string) ||
            (details?.techName as string) ||
            "Unknown Tech";
          const reason =
            (details?.reason as string) || insight.summary || "";

          setSuggestion({
            techName,
            reason,
            confidence: insight.confidence,
            insightId: insight.id,
          });
        }
      } catch {
        // Non-critical — silently fail
      }
    };

    load();
    return () => { cancelled = true; };
  }, [entityId]);

  const toast = useToast();

  const handleDismiss = async () => {
    if (!suggestion) return;
    setDismissed(true);
    try {
      const res = await apiFetch(`/api/ai/insights/${suggestion.insightId}/acknowledge`, {
        method: "PATCH",
      });
      if (!res.ok) {
        setDismissed(false);
        toast.error("Failed to dismiss suggestion");
      }
    } catch {
      setDismissed(false);
      toast.error("Failed to dismiss suggestion");
    }
  };

  if (!suggestion || dismissed) return null;

  return (
    <div className="ai-suggested-tech-badge">
      <div className="ai-suggested-tech-icon">AI</div>
      <div className="ai-suggested-tech-content">
        <span className="ai-suggested-tech-label">AI Suggested:</span>
        <span className="ai-suggested-tech-name">{suggestion.techName}</span>
        <span className="ai-suggested-tech-confidence">
          {Math.round(suggestion.confidence * 100)}%
        </span>
      </div>
      {suggestion.reason && (
        <span className="ai-suggested-tech-reason" title={suggestion.reason}>
          {suggestion.reason}
        </span>
      )}
      <button
        className="ai-suggested-tech-dismiss"
        onClick={handleDismiss}
        title="Dismiss suggestion"
      >
        &times;
      </button>
    </div>
  );
}
