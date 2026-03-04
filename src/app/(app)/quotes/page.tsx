"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuoteStatus } from "@prisma/client";
import "./quotes.css";

interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  total: string | number;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
  };
  site: {
    id: string;
    name: string;
  } | null;
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const response = await fetch(`/api/quotes?${params}`);
      if (response.ok) {
        const result = await response.json();
        setQuotes(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch quotes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, quote: Quote) => {
    e.stopPropagation();
    setQuoteToDelete(quote);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/quotes/${quoteToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setQuotes(quotes.filter(q => q.id !== quoteToDelete.id));
        setDeleteModalOpen(false);
        setQuoteToDelete(null);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete quote");
      }
    } catch (error) {
      console.error("Failed to delete quote:", error);
      alert("An error occurred while deleting the quote");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusConfig = (status: QuoteStatus) => {
    const configs = {
      DRAFT: { color: "var(--status-draft)", bg: "var(--status-draft-bg)", label: "Draft" },
      SENT: { color: "var(--status-in-progress)", bg: "var(--status-in-progress-bg)", label: "Sent" },
      APPROVED: { color: "var(--status-completed)", bg: "var(--status-completed-bg)", label: "Approved" },
      REJECTED: { color: "var(--status-rejected)", bg: "var(--status-rejected-bg)", label: "Rejected" },
      EXPIRED: { color: "var(--status-expired)", bg: "var(--status-expired-bg)", label: "Expired" },
      CONVERTED: { color: "var(--status-converted)", bg: "var(--status-converted-bg)", label: "Converted" },
      CANCELED: { color: "var(--text-secondary)", bg: "var(--background-secondary)", label: "Canceled" },
    };
    return configs[status] || configs.DRAFT;
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  // Filter quotes by search term
  const filteredQuotes = quotes.filter((quote) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      quote.quoteNumber.toLowerCase().includes(search) ||
      quote.title.toLowerCase().includes(search) ||
      quote.customer.name.toLowerCase().includes(search) ||
      quote.site?.name?.toLowerCase().includes(search)
    );
  });

  // Calculate summary stats
  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === QuoteStatus.DRAFT).length,
    sent: quotes.filter(q => q.status === QuoteStatus.SENT).length,
    approved: quotes.filter(q => q.status === QuoteStatus.APPROVED).length,
    totalValue: quotes.reduce((sum, q) => sum + Number(q.total), 0),
  };

  return (
    <div className="quotes-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Quotes & Estimates</h1>
            <p className="page-subtitle">
              Manage customer quotes and proposals
            </p>
          </div>
          <button
            onClick={() => router.push("/quotes/new")}
            className="btn-primary"
          >
            <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Quote
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">Total Quotes</div>
          <div className="summary-value">{stats.total}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Draft</div>
          <div className="summary-value" style={{ color: "var(--status-draft)" }}>
            {stats.draft}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Sent / Pending</div>
          <div className="summary-value" style={{ color: "var(--status-in-progress)" }}>
            {stats.sent}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Approved</div>
          <div className="summary-value" style={{ color: "var(--status-completed)" }}>
            {stats.approved}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Value</div>
          <div className="summary-value">${stats.totalValue.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search quotes by number, title, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | "ALL")}
          className="filter-select"
        >
          <option value="ALL">All Statuses</option>
          <option value={QuoteStatus.DRAFT}>Draft</option>
          <option value={QuoteStatus.SENT}>Sent</option>
          <option value={QuoteStatus.APPROVED}>Approved</option>
          <option value={QuoteStatus.REJECTED}>Rejected</option>
          <option value={QuoteStatus.EXPIRED}>Expired</option>
          <option value={QuoteStatus.CONVERTED}>Converted</option>
          <option value={QuoteStatus.CANCELED}>Canceled</option>
        </select>
      </div>

      {/* Quotes List */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <div>Loading quotes...</div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3>{searchTerm ? "No matching quotes found" : "No quotes yet"}</h3>
          <p>{searchTerm ? "Try adjusting your search" : "Create your first quote to get started"}</p>
          {!searchTerm && (
            <button onClick={() => router.push("/quotes/new")} className="btn-primary">
              Create Your First Quote
            </button>
          )}
        </div>
      ) : (
        <div className="quotes-grid">
          {filteredQuotes.map((quote) => {
            const statusConfig = getStatusConfig(quote.status);
            const expired = isExpired(quote.validUntil);

            return (
              <div
                key={quote.id}
                className="quote-card"
                onClick={() => router.push(`/quotes/${quote.id}`)}
              >
                <div className="quote-header">
                  <div className="quote-number">{quote.quoteNumber}</div>
                  <div className="quote-header-right">
                    <span
                      className="status-badge"
                      style={{
                        color: statusConfig.color,
                        backgroundColor: statusConfig.bg,
                      }}
                    >
                      {statusConfig.label}
                    </span>
                    {quote.status === QuoteStatus.DRAFT && (
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDeleteClick(e, quote)}
                        title="Delete quote"
                      >
                        <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="quote-title">{quote.title}</div>

                <div className="quote-customer">
                  <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <div>
                    <div className="customer-name">{quote.customer.name}</div>
                    {quote.site && (
                      <div className="site-name">{quote.site.name}</div>
                    )}
                  </div>
                </div>

                <div className="quote-footer">
                  <div className="quote-total">
                    <span className="total-label">Total:</span>
                    <span className="total-value">${Number(quote.total).toFixed(2)}</span>
                  </div>
                  <div className="quote-dates">
                    {quote.validUntil && (
                      <div className={`valid-until ${expired ? "expired" : ""}`}>
                        {expired ? "Expired" : "Valid"} {new Date(quote.validUntil).toLocaleDateString()}
                      </div>
                    )}
                    <div className="created-date">
                      Created {new Date(quote.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && quoteToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Quote</h3>
              <button
                onClick={() => !deleting && setDeleteModalOpen(false)}
                className="modal-close"
                disabled={deleting}
              >
                <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <svg className="warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>Are you sure you want to delete quote <strong>{quoteToDelete.quoteNumber}</strong>?</p>
                <p className="delete-subtitle">"{quoteToDelete.title}"</p>
                <p className="delete-note">This action cannot be undone.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="btn-cancel"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn-danger"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="spinner-sm"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
