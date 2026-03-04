"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  total: number | string;
  validUntil: string | null;
  createdAt: string;
  site: { name: string } | null;
  _count: { lineItems: number };
}

export default function PortalQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/quotes")
      .then((res) => res.json())
      .then((data) => setQuotes(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getStatusClass = (status: string) =>
    status?.toLowerCase().replace("_", "-") || "";

  if (loading) {
    return (
      <div className="portal-loading">
        <div className="portal-spinner" />
        <span>Loading quotes...</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="portal-page-title">Quotes</h1>

      <div className="portal-card">
        {quotes.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon">📋</div>
            <p>No quotes to display.</p>
          </div>
        ) : (
          <div>
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/portal/quotes/${quote.id}`}
                className="portal-list-item"
              >
                <div className="portal-list-item-main">
                  <div className="portal-list-item-title">{quote.title}</div>
                  <div className="portal-list-item-subtitle">
                    {quote.quoteNumber}
                    {quote.site && <> &middot; {quote.site.name}</>}
                    {" "}&middot; {new Date(quote.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="portal-list-item-right">
                  <span className={`portal-status ${getStatusClass(quote.status)}`}>
                    {quote.status}
                  </span>
                  <span className="portal-amount">
                    ${Number(quote.total).toFixed(2)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
