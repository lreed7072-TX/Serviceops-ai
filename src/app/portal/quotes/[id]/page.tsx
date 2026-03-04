"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface QuoteLineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
}

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  title: string;
  description: string | null;
  status: string;
  subtotal: number | string;
  tax: number | string;
  taxRate: number | string;
  total: number | string;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  approvedAt: string | null;
  site: { name: string } | null;
  lineItems: QuoteLineItem[];
}

export default function PortalQuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params?.id as string;
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (quoteId) loadQuote();
  }, [quoteId]);

  const loadQuote = () => {
    fetch(`/api/portal/quotes/${quoteId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setQuote(data.data))
      .catch(() => router.push("/portal/quotes"))
      .finally(() => setLoading(false));
  };

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/portal/quotes/${quoteId}/accept`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || "Failed to accept quote.");
        return;
      }

      loadQuote();
    } catch {
      setActionError("Failed to accept quote. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const getStatusClass = (status: string) =>
    status?.toLowerCase().replace("_", "-") || "";

  if (loading) {
    return (
      <div className="portal-loading">
        <div className="portal-spinner" />
        <span>Loading quote...</span>
      </div>
    );
  }

  if (!quote) return null;

  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date();

  return (
    <div>
      <Link href="/portal/quotes" style={{ color: "var(--text-light)", textDecoration: "none", fontSize: "0.875rem" }}>
        ← Back to Quotes
      </Link>

      <div className="portal-detail-header" style={{ marginTop: "var(--space-md)" }}>
        <div>
          <div className="portal-detail-title">{quote.title}</div>
          <div className="portal-detail-number">
            {quote.quoteNumber}
            <span className={`portal-status ${getStatusClass(quote.status)}`} style={{ marginLeft: "12px" }}>
              {quote.status}
            </span>
          </div>
        </div>

        {quote.status === "SENT" && !isExpired && (
          <div className="portal-detail-actions">
            <button
              onClick={handleAccept}
              className="portal-btn portal-btn-success"
              disabled={accepting}
            >
              {accepting ? "Accepting..." : "Accept Quote"}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="portal-login-error" style={{ marginBottom: "var(--space-md)" }}>
          {actionError}
        </div>
      )}

      <div className="portal-detail-meta">
        {quote.site && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Site</span>
            <span className="portal-detail-meta-value">{quote.site.name}</span>
          </div>
        )}
        <div className="portal-detail-meta-item">
          <span className="portal-detail-meta-label">Date</span>
          <span className="portal-detail-meta-value">
            {new Date(quote.createdAt).toLocaleDateString()}
          </span>
        </div>
        {quote.validUntil && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Valid Until</span>
            <span className="portal-detail-meta-value" style={isExpired ? { color: "var(--error)" } : {}}>
              {new Date(quote.validUntil).toLocaleDateString()}
              {isExpired && " (Expired)"}
            </span>
          </div>
        )}
        {quote.approvedAt && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Approved</span>
            <span className="portal-detail-meta-value">
              {new Date(quote.approvedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {quote.description && (
        <div className="portal-card" style={{ marginBottom: "var(--space-md)" }}>
          <div className="portal-card-body">
            <p style={{ color: "var(--text-light)", fontSize: "0.9375rem" }}>{quote.description}</p>
          </div>
        </div>
      )}

      <div className="portal-card">
        <div className="portal-card-header">
          <h2>Line Items</h2>
        </div>
        <table className="portal-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Type</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.itemType}</td>
                <td className="text-right">{Number(item.quantity)}</td>
                <td className="text-right">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="text-right">${Number(item.totalPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="portal-card-body">
          <div className="portal-totals">
            <div className="portal-total-row">
              <span className="portal-total-label">Subtotal</span>
              <span className="portal-total-value">${Number(quote.subtotal).toFixed(2)}</span>
            </div>
            {Number(quote.tax) > 0 && (
              <div className="portal-total-row">
                <span className="portal-total-label">Tax ({Number(quote.taxRate)}%)</span>
                <span className="portal-total-value">${Number(quote.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="portal-total-row grand-total">
              <span className="portal-total-label">Total</span>
              <span className="portal-total-value">${Number(quote.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {(quote.notes || quote.terms) && (
        <div className="portal-card" style={{ marginTop: "var(--space-md)" }}>
          <div className="portal-card-body">
            {quote.notes && (
              <div style={{ marginBottom: quote.terms ? "var(--space-md)" : 0 }}>
                <div className="portal-detail-meta-label" style={{ marginBottom: "4px" }}>Notes</div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-light)", whiteSpace: "pre-wrap" }}>{quote.notes}</p>
              </div>
            )}
            {quote.terms && (
              <div>
                <div className="portal-detail-meta-label" style={{ marginBottom: "4px" }}>Terms & Conditions</div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-light)", whiteSpace: "pre-wrap" }}>{quote.terms}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
