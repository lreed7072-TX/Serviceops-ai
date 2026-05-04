"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { QuoteStatus, QuoteLineItemType } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { apiFetch } from "@/lib/api";
import AiQuoteSuggestions from "@/components/ai/AiQuoteSuggestions";
import "./quote-detail.css";

interface QuoteLineItem {
  id: string;
  itemType: QuoteLineItemType;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  totalPrice: string | number;
  sortOrder: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  description: string | null;
  status: QuoteStatus;
  subtotal: string | number;
  tax: string | number;
  taxRate: string | number;
  total: string | number;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    primaryEmail: string | null;
  };
  site: {
    id: string;
    name: string;
  } | null;
  lineItems: QuoteLineItem[];
  createdBy: {
    name: string | null;
  };
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Confirm dialog state
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [printing, setPrinting] = useState(false);

  const toast = useToast();

  const quoteId = params?.id;

  useEffect(() => {
    if (quoteId) {
      fetchQuote();
    }
  }, [quoteId]);

  const fetchQuote = async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/api/quotes/${quoteId}`);
      if (response.ok) {
        const result = await response.json();
        setQuote(result.data);
      } else {
        console.error("Failed to fetch quote");
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!quote) return;
    
    let rejectionReason = null;
    if (newStatus === QuoteStatus.REJECTED) {
      rejectionReason = prompt("Please provide a reason for rejection:");
      if (!rejectionReason) return;
    }

    try {
      const response = await apiFetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          rejectionReason
        }),
      });

      if (response.ok) {
        await fetchQuote();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("An error occurred while updating status");
    }
  };

  const handleConvertToWorkOrder = async () => {
    if (!quote) return;

    setConverting(true);
    try {
      const response = await apiFetch(`/api/quotes/${quote.id}/accept`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.data.message);
        router.push(`/work-orders/${result.data.workOrder.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to convert quote");
      }
    } catch (error) {
      console.error("Failed to convert quote:", error);
      toast.error("An error occurred while converting");
    } finally {
      setConverting(false);
      setShowConvertConfirm(false);
    }
  };

  const handlePrint = async () => {
    if (!quote) return;
    setPrinting(true);
    try {
      const response = await apiFetch(`/api/quotes/${quote.id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Open PDF in hidden iframe and trigger print
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // Fallback: open in new tab for manual print
          window.open(url, "_blank");
        }
        // Cleanup after print dialog closes
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(url);
        }, 120000);
      };
    } catch (error) {
      console.error("Failed to print:", error);
      toast.error("Failed to generate PDF for printing");
    } finally {
      setPrinting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!quote) return;

    setDownloadingPdf(true);
    try {
      const response = await apiFetch(`/api/quotes/${quote.id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${quote.quoteNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download PDF:", error);
      toast.error("Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleEmailQuote = () => {
    if (!quote) return;
    setEmailInput(quote.customer.primaryEmail || "");
    setShowEmailModal(true);
  };

  const confirmEmailQuote = async () => {
    if (!quote || !emailInput.trim()) return;

    const emails = emailInput
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (emails.length === 0) return;

    setEmailing(true);
    try {
      const response = await apiFetch(`/api/quotes/${quote.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      if (response.ok) {
        toast.success(`Quote sent to ${emails.join(", ")}`);
        setShowEmailModal(false);
        setEmailInput("");
        await fetchQuote();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send email");
      }
    } catch (error) {
      console.error("Failed to email quote:", error);
      toast.error("An error occurred while sending email");
    } finally {
      setEmailing(false);
    }
  };

  const handleDuplicateQuote = async () => {
    if (!quote) return;

    setDuplicating(true);
    try {
      const response = await apiFetch(`/api/quotes/${quote.id}/duplicate`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/quotes/${result.data.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to duplicate quote");
      }
    } catch (error) {
      console.error("Failed to duplicate quote:", error);
      toast.error("An error occurred while duplicating");
    } finally {
      setDuplicating(false);
      setShowDuplicateConfirm(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!quote) return;

    setDeleting(true);
    try {
      const response = await apiFetch(`/api/quotes/${quote.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/quotes");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete quote");
      }
    } catch (error) {
      console.error("Failed to delete quote:", error);
      toast.error("An error occurred while deleting");
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const handleAcceptAiItem = useCallback(
    async (item: { description: string; quantity: number; unitPrice: number }) => {
      if (!quote) return;
      try {
        // Append the AI-suggested item to existing line items via PATCH
        const existingItems = quote.lineItems.map((li) => ({
          itemType: li.itemType,
          description: li.description,
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          totalPrice: Number(li.totalPrice),
        }));

        const newItem = {
          itemType: "SERVICE" as QuoteLineItemType,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        };

        const response = await apiFetch(`/api/quotes/${quote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineItems: [...existingItems, newItem],
          }),
        });
        if (response.ok) {
          toast.success(`Added "${item.description}" to quote`);
          await fetchQuote();
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to add line item");
        }
      } catch (error) {
        console.error("Failed to add AI suggested item:", error);
        toast.error("An error occurred while adding line item");
      }
    },
    [quote, toast]
  );

  if (loading) {
    return (
      <div className="quote-detail-container">
        <div className="loading-state">
          <div className="loading-spinner-large"></div>
          <div className="loading-text">Loading quote...</div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="quote-detail-container">
        <div className="loading-state">
          <div className="loading-text">Quote not found</div>
        </div>
      </div>
    );
  }

  const getStatusClass = (status: QuoteStatus) => {
    return status.toLowerCase();
  };

  const getItemTypeClass = (type: QuoteLineItemType) => {
    return type.toLowerCase();
  };

  return (
    <div className="quote-detail-container">
      {/* Header */}
      <div className="quote-detail-header">
        <button
          onClick={() => router.push("/quotes")}
          className="back-link"
        >
          ← Back to Quotes
        </button>
        
        <div className="quote-header-content">
          <div className="quote-header-left">
            <div className="quote-number-badge">{quote.quoteNumber}</div>
            <div className="quote-title">{quote.title}</div>
            <div className="quote-metadata">
              <div className="quote-meta-item">
                <span className="quote-meta-icon">👤</span>
                <span>Created by <span className="quote-meta-value">{quote.createdBy.name || "Unknown"}</span></span>
              </div>
              <div className="quote-meta-item">
                <span className="quote-meta-icon">📅</span>
                <span className="quote-meta-value">{new Date(quote.createdAt).toLocaleDateString()}</span>
              </div>
              {quote.validUntil && (
                <div className="quote-meta-item">
                  <span className="quote-meta-icon">⏳</span>
                  <span>Valid until <span className="quote-meta-value">{new Date(quote.validUntil).toLocaleDateString()}</span></span>
                </div>
              )}
            </div>
          </div>
          
          <div className={`quote-status-badge-large ${getStatusClass(quote.status)}`}>
            {quote.status}
          </div>
        </div>
      </div>

      {/* Customer Information */}
      <div className="quote-section">
        <h2 className="quote-section-title">
          <span className="section-icon">🏢</span>
          Customer Information
        </h2>
        <div className="customer-grid">
          <div className="customer-info-block">
            <div className="customer-label">Customer</div>
            <div className="customer-value">{quote.customer.name}</div>
            {quote.customer.primaryEmail && (
              <a href={`mailto:${quote.customer.primaryEmail}`} className="customer-email">
                {quote.customer.primaryEmail}
              </a>
            )}
          </div>
          {quote.site && (
            <div className="customer-info-block">
              <div className="customer-label">Site</div>
              <div className="customer-value">{quote.site.name}</div>
            </div>
          )}
        </div>
      </div>

      {/* Quote Details */}
      <div className="quote-section">
        <h2 className="quote-section-title">
          <span className="section-icon">📋</span>
          Quote Details
        </h2>
        
        {quote.description && (
          <div className="quote-description-block">
            <div className="detail-label">Description</div>
            <div className="quote-description-text">{quote.description}</div>
          </div>
        )}

        <div className="quote-details-grid">
          <div className="detail-block">
            <div className="detail-label">Created</div>
            <div className="detail-value">{new Date(quote.createdAt).toLocaleDateString()}</div>
            <div className="detail-subtext">by {quote.createdBy.name || "Unknown"}</div>
          </div>
          
          {quote.validUntil && (
            <div className="detail-block">
              <div className="detail-label">Valid Until</div>
              <div className="detail-value">{new Date(quote.validUntil).toLocaleDateString()}</div>
            </div>
          )}
          
          {quote.sentAt && (
            <div className="detail-block">
              <div className="detail-label">Sent</div>
              <div className="detail-value">{new Date(quote.sentAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>

        {quote.approvedAt && (
          <div className="status-alert approved">
            <div className="status-alert-title">
              ✓ Approved on {new Date(quote.approvedAt).toLocaleDateString()}
            </div>
            {quote.approvedByName && (
              <div className="status-alert-text">
                Approved by {quote.approvedByName}
              </div>
            )}
          </div>
        )}

        {quote.rejectedAt && (
          <div className="status-alert rejected">
            <div className="status-alert-title">
              ✗ Rejected on {new Date(quote.rejectedAt).toLocaleDateString()}
            </div>
            {quote.rejectionReason && (
              <div className="status-alert-text">
                Reason: {quote.rejectionReason}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="quote-section">
        <h2 className="quote-section-title">
          <span className="section-icon">📦</span>
          Line Items
        </h2>
        
        <div className="line-items-table-wrapper">
          <table className="line-items-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th className="align-right">Qty</th>
                <th className="align-right">Unit Price</th>
                <th className="align-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={`item-type-badge ${getItemTypeClass(item.itemType)}`}>
                      {item.itemType}
                    </span>
                  </td>
                  <td>{item.description}</td>
                  <td className="align-right">{Number(item.quantity)}</td>
                  <td className="align-right">${Number(item.unitPrice).toFixed(2)}</td>
                  <td className="align-right" style={{ fontWeight: 600 }}>
                    ${Number(item.totalPrice).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="totals-section">
          <div className="totals-grid">
            <div className="total-row">
              <span className="total-label">Subtotal</span>
              <span className="total-value">${Number(quote.subtotal).toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span className="total-label">Tax ({Number(quote.taxRate)}%)</span>
              <span className="total-value">${Number(quote.tax).toFixed(2)}</span>
            </div>
            <div className="total-row grand-total">
              <span className="total-label">Total</span>
              <span className="total-value">${Number(quote.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* AI Line Item Suggestions */}
        {quote.status !== QuoteStatus.APPROVED &&
          quote.status !== QuoteStatus.CONVERTED &&
          quote.status !== QuoteStatus.CANCELED && (
            <AiQuoteSuggestions
              quoteId={quote.id}
              onAcceptItem={handleAcceptAiItem}
            />
          )}
      </div>

      {/* Notes & Terms */}
      {(quote.notes || quote.terms) && (
        <div className="quote-section">
          <h2 className="quote-section-title">
            <span className="section-icon">📝</span>
            Notes & Terms
          </h2>
          <div className="notes-grid">
            {quote.notes && (
              <div className="notes-block">
                <div className="notes-title">
                  💡 Notes
                </div>
                <div className="notes-text">{quote.notes}</div>
              </div>
            )}
            {quote.terms && (
              <div className="notes-block">
                <div className="notes-title">
                  📜 Terms & Conditions
                </div>
                <div className="notes-text">{quote.terms}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="actions-section no-print">
        <h3 className="actions-title">
          <span className="section-icon">⚡</span>
          Actions
        </h3>
        <div className="actions-grid">
          {/* Export & Communication Actions */}
          <button
            onClick={handlePrint}
            disabled={printing}
            className="action-button primary"
          >
            <span>{printing ? "⏳" : "🖨️"}</span>
            {printing ? "Preparing..." : "Print Quote"}
          </button>
          
          <button
            onClick={handleExportPDF}
            disabled={downloadingPdf}
            className="action-button primary"
          >
            <span>{downloadingPdf ? "⏳" : "📄"}</span>
            {downloadingPdf ? "Generating..." : "Download PDF"}
          </button>
          
          <button
            onClick={handleEmailQuote}
            disabled={emailing}
            className="action-button primary"
          >
            <span>{emailing ? "⏳" : "📧"}</span>
            {emailing ? "Sending..." : "Email to Customer"}
          </button>
          
          <button
            onClick={() => setShowDuplicateConfirm(true)}
            disabled={duplicating}
            className="action-button secondary"
          >
            <span>{duplicating ? "⏳" : "📋"}</span>
            {duplicating ? "Duplicating..." : "Duplicate Quote"}
          </button>

          {/* Status Change Actions */}
          {quote.status === QuoteStatus.DRAFT && (
            <button
              onClick={() => handleStatusChange(QuoteStatus.SENT)}
              className="action-button primary"
            >
              <span>📤</span> Mark as Sent
            </button>
          )}
          
          {(quote.status === QuoteStatus.SENT || quote.status === QuoteStatus.DRAFT) && (
            <>
              <button
                onClick={() => setShowConvertConfirm(true)}
                disabled={converting}
                className="action-button success"
              >
                <span>{converting ? "⏳" : "✓"}</span>
                {converting ? "Converting..." : "Convert to Work Order"}
              </button>
              <button
                onClick={() => handleStatusChange(QuoteStatus.REJECTED)}
                className="action-button danger"
              >
                <span>✗</span> Reject Quote
              </button>
            </>
          )}
          
          {quote.status !== QuoteStatus.APPROVED && quote.status !== QuoteStatus.CONVERTED && quote.status !== QuoteStatus.CANCELED && (
            <button
              onClick={() => router.push(`/quotes/${quote.id}/edit`)}
              className="action-button primary"
            >
              <span>✏️</span> Edit Quote
            </button>
          )}
          
          {quote.status !== QuoteStatus.CANCELED && quote.status !== QuoteStatus.CONVERTED && (
            <button
              onClick={() => handleStatusChange(QuoteStatus.CANCELED)}
              className="action-button secondary"
            >
              <span>🚫</span> Cancel Quote
            </button>
          )}

          {quote.status === QuoteStatus.DRAFT && (
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="action-button danger"
            >
              <span>🗑️</span> Delete Quote
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteQuote}
        title="Delete Quote"
        message={`Are you sure you want to delete quote ${quote.quoteNumber}?`}
        detail={`"${quote.title}" -- This action cannot be undone.`}
        confirmLabel="Delete Quote"
        variant="danger"
        loading={deleting}
      />

      {/* Convert to Work Order Confirmation */}
      <ConfirmDialog
        open={showConvertConfirm}
        onClose={() => setShowConvertConfirm(false)}
        onConfirm={handleConvertToWorkOrder}
        title="Convert to Work Order"
        message={`Convert quote ${quote.quoteNumber} to a work order?`}
        detail="A new work order will be created from this quote's line items."
        confirmLabel="Convert"
        variant="default"
        loading={converting}
      />

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => { if (!emailing) { setShowEmailModal(false); setEmailInput(""); } }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Email Quote {quote.quoteNumber}</h2>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label className="field-label">Recipient(s)</label>
                <input
                  type="text"
                  className="field-input"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="email@example.com"
                  disabled={emailing}
                />
                <p style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginTop: "0.25rem" }}>
                  Separate multiple addresses with commas
                </p>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.75rem" }}>
                The professional PDF quote will be attached to the email.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => { setShowEmailModal(false); setEmailInput(""); }} disabled={emailing}>Cancel</button>
              <button className="btn-submit" onClick={confirmEmailQuote} disabled={!emailInput.trim() || emailing}>
                {emailing ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation */}
      <ConfirmDialog
        open={showDuplicateConfirm}
        onClose={() => setShowDuplicateConfirm(false)}
        onConfirm={handleDuplicateQuote}
        title="Duplicate Quote"
        message={`Create a copy of quote ${quote.quoteNumber}?`}
        detail="A new draft quote will be created with the same line items."
        confirmLabel="Duplicate"
        variant="default"
        loading={duplicating}
      />
    </div>
  );
}
