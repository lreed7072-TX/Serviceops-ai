"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import "./AiQuoteSuggestions.css";

interface SuggestedItem {
  description: string;
  quantity: number;
  unitPrice: number;
  justification: string;
}

interface AiInsight {
  id: string;
  insightType: string;
  title: string;
  summary: string;
  confidence: number;
  details: Record<string, unknown> | null;
}

interface AiQuoteSuggestionsProps {
  quoteId: string;
  onAcceptItem: (item: {
    description: string;
    quantity: number;
    unitPrice: number;
  }) => void;
}

export default function AiQuoteSuggestions({
  quoteId,
  onAcceptItem,
}: AiQuoteSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);
  const [insightId, setInsightId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
  const [dismissedIndices, setDismissedIndices] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await apiFetch(
          `/api/ai/insights?entityType=Quote&entityId=${encodeURIComponent(quoteId)}&insightType=QUOTE_SUGGESTION&activeOnly=true`
        );
        if (!res.ok) return;
        const json = await res.json();
        const insights: AiInsight[] = Array.isArray(json.data) ? json.data : [];

        if (!cancelled && insights.length > 0) {
          const insight = insights[0];
          setInsightId(insight.id);
          const details = insight.details as Record<string, unknown> | null;
          const items = (details?.suggestedItems as SuggestedItem[]) || [];
          setSuggestions(
            items.map((item) => ({
              description: item.description || "",
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || 0,
              justification: item.justification || "",
            }))
          );
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const handleAccept = useCallback(
    async (index: number) => {
      const item = suggestions[index];
      if (!item) return;

      onAcceptItem({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });

      setAcceptedIndices((prev) => new Set(prev).add(index));

      // If all items are accepted or dismissed, acknowledge the insight
      const newAccepted = new Set(acceptedIndices).add(index);
      const allHandled =
        suggestions.length > 0 &&
        suggestions.every(
          (_, i) => newAccepted.has(i) || dismissedIndices.has(i)
        );

      if (allHandled && insightId) {
        try {
          await apiFetch(`/api/ai/insights/${insightId}/acknowledge`, {
            method: "PATCH",
          });
        } catch {
          // Silently fail
        }
      }
    },
    [suggestions, acceptedIndices, dismissedIndices, insightId, onAcceptItem]
  );

  const handleDismiss = useCallback(
    async (index: number) => {
      setDismissedIndices((prev) => new Set(prev).add(index));

      // If all items are accepted or dismissed, acknowledge the insight
      const newDismissed = new Set(dismissedIndices).add(index);
      const allHandled =
        suggestions.length > 0 &&
        suggestions.every(
          (_, i) => acceptedIndices.has(i) || newDismissed.has(i)
        );

      if (allHandled && insightId) {
        try {
          await apiFetch(`/api/ai/insights/${insightId}/acknowledge`, {
            method: "PATCH",
          });
        } catch {
          // Silently fail
        }
      }
    },
    [suggestions, acceptedIndices, dismissedIndices, insightId]
  );

  if (loading || suggestions.length === 0) return null;

  const visibleSuggestions = suggestions.filter(
    (_, i) => !acceptedIndices.has(i) && !dismissedIndices.has(i)
  );

  if (visibleSuggestions.length === 0) return null;

  return (
    <div className="ai-quote-suggestions">
      <div className="ai-quote-suggestions-header">
        <div className="ai-quote-suggestions-label">
          <span className="ai-quote-icon">AI</span>
          <span className="ai-quote-title">AI Suggestions</span>
          <span className="ai-quote-count">{visibleSuggestions.length}</span>
        </div>
      </div>
      <div className="ai-quote-suggestions-list">
        {suggestions.map((item, index) => {
          if (acceptedIndices.has(index) || dismissedIndices.has(index))
            return null;

          return (
            <div key={index} className="ai-quote-suggestion-item">
              <div className="ai-suggestion-main">
                <div className="ai-suggestion-description">
                  {item.description}
                </div>
                <div className="ai-suggestion-details">
                  <span className="ai-suggestion-qty">
                    Qty: {item.quantity}
                  </span>
                  <span className="ai-suggestion-price">
                    ${item.unitPrice.toFixed(2)} / unit
                  </span>
                  <span className="ai-suggestion-total">
                    Total: ${(item.quantity * item.unitPrice).toFixed(2)}
                  </span>
                </div>
                {item.justification && (
                  <div className="ai-suggestion-justification">
                    {item.justification}
                  </div>
                )}
              </div>
              <div className="ai-suggestion-actions">
                <button
                  className="ai-suggestion-btn ai-suggestion-btn-accept"
                  onClick={() => handleAccept(index)}
                >
                  Accept
                </button>
                <button
                  className="ai-suggestion-btn ai-suggestion-btn-dismiss"
                  onClick={() => handleDismiss(index)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
