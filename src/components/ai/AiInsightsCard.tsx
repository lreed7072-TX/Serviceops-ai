"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import "./AiInsightsCard.css";

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

interface AiInsightsCardProps {
  entityType: string;
  entityId: string;
}

export default function AiInsightsCard({ entityType, entityId }: AiInsightsCardProps) {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    if (!entityType || !entityId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(
          `/api/ai/insights?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&activeOnly=true`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setInsights(Array.isArray(json.data) ? json.data : []);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const handleAcknowledge = async (insightId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAcknowledging(insightId);
    try {
      const res = await apiFetch(`/api/ai/insights/${insightId}/acknowledge`, {
        method: "PATCH",
      });
      if (res.ok) {
        setInsights((prev) => prev.filter((i) => i.id !== insightId));
      }
    } catch {
      // Silently fail
    } finally {
      setAcknowledging(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) return null;

  return (
    <div className="ai-insights-card">
      <div className="ai-insights-card-header">
        <h3>
          AI Insights
          {insights.length > 0 && (
            <span className="ai-insights-count-badge">{insights.length}</span>
          )}
        </h3>
      </div>

      {insights.length === 0 ? (
        <div className="ai-insights-empty">No AI insights for this entity</div>
      ) : (
        insights.map((insight) => {
          const isExpanded = expandedId === insight.id;
          return (
            <div key={insight.id} className="ai-insight-row">
              <div
                className="ai-insight-row-header"
                onClick={() => toggleExpand(insight.id)}
              >
                <span className="ai-insight-chevron">
                  {isExpanded ? "\u25BE" : "\u25B8"}
                </span>
                <span className={`ai-insight-severity ${insight.severity.toLowerCase()}`}>
                  {insight.severity}
                </span>
                <div className="ai-insight-info">
                  <div className="ai-insight-title">{insight.title}</div>
                  {!isExpanded && (
                    <div className="ai-insight-summary-preview">
                      {insight.summary}
                    </div>
                  )}
                </div>
                <span className="ai-insight-confidence">
                  {Math.round(insight.confidence * 100)}%
                </span>
                <button
                  className="ai-insight-ack-btn"
                  onClick={(e) => handleAcknowledge(insight.id, e)}
                  disabled={acknowledging === insight.id}
                >
                  {acknowledging === insight.id ? "..." : "Acknowledge"}
                </button>
              </div>

              {isExpanded && (
                <div className="ai-insight-expanded">
                  <p className="ai-insight-full-summary">{insight.summary}</p>

                  {insight.actionRecommended && (
                    <div className="ai-insight-action">
                      <strong>Recommended Action</strong>
                      {insight.actionRecommended}
                    </div>
                  )}

                  {insight.details && Object.keys(insight.details).length > 0 && (
                    <div className="ai-insight-details">
                      {JSON.stringify(insight.details, null, 2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
