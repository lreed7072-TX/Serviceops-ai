"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import "./AiDraftSummary.css";

interface AiInsight {
  id: string;
  insightType: string;
  title: string;
  summary: string;
  confidence: number;
  details: Record<string, unknown> | null;
  acknowledgedAt: string | null;
}

interface AiDraftSummaryProps {
  entityId: string;
}

export default function AiDraftSummary({ entityId }: AiDraftSummaryProps) {
  const [draft, setDraft] = useState<{
    insightId: string;
    summaryText: string;
    title: string;
    confidence: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await apiFetch(
          `/api/ai/insights?entityType=WorkOrder&entityId=${encodeURIComponent(entityId)}&insightType=REPORT_DRAFT&activeOnly=true`
        );
        if (!res.ok) return;
        const json = await res.json();
        const insights: AiInsight[] = Array.isArray(json.data) ? json.data : [];

        if (!cancelled && insights.length > 0) {
          const insight = insights[0];
          const details = insight.details as Record<string, unknown> | null;
          const summaryText =
            (details?.draftText as string) ||
            (details?.reportText as string) ||
            insight.summary ||
            "";

          setDraft({
            insightId: insight.id,
            summaryText,
            title: insight.title,
            confidence: insight.confidence,
          });
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [entityId]);

  const handleCopyToClipboard = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = draft.summaryText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUseAsReport = async () => {
    if (!draft) return;
    // Acknowledge the insight (mark as used)
    try {
      await apiFetch(`/api/ai/insights/${draft.insightId}/acknowledge`, {
        method: "PATCH",
      });
    } catch {
      // Silently fail
    }
    // Copy to clipboard for pasting into report
    await handleCopyToClipboard();
  };

  if (loading || !draft) return null;

  return (
    <div className="ai-draft-summary-card">
      <div className="ai-draft-summary-header">
        <div className="ai-draft-summary-label">
          <span className="ai-draft-icon">AI</span>
          <span className="ai-draft-title">AI Generated Draft</span>
          <span className="ai-draft-confidence">
            {Math.round(draft.confidence * 100)}% confidence
          </span>
        </div>
        <div className="ai-draft-actions">
          <button
            className="ai-draft-btn ai-draft-btn-copy"
            onClick={handleCopyToClipboard}
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            className="ai-draft-btn ai-draft-btn-use"
            onClick={handleUseAsReport}
          >
            Use as Report
          </button>
        </div>
      </div>
      <div className="ai-draft-summary-body">
        <p className="ai-draft-text">{draft.summaryText}</p>
      </div>
    </div>
  );
}
