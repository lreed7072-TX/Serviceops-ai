"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  User,
  FileText,
  CheckCircle,
  XCircle,
  Pencil,
  ArrowRightCircle,
  X,
  ExternalLink,
  Clock,
  StickyNote,
  AlertCircle,
} from "lucide-react";
import "../opportunities.css";

/* ─── Types ──────────────────────────────────────────────────────── */

type OpportunityDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  amount: string | number | null;
  expectedCloseDate: string | null;
  wonLostAt: string | null;
  wonLostReason: string | null;
  convertedQuoteId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string };
  contact: { id: string; firstName: string; lastName: string } | null;
  site: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  convertedQuote: { id: string; quoteNumber: string } | null;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
};

const STAGES_IN_ORDER = [
  "PROSPECTING",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
];

const STAGE_LABELS: Record<string, string> = {
  PROSPECTING: "Prospecting",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStageClass(status: string): string {
  switch (status) {
    case "PROSPECTING":
      return "prospecting";
    case "QUALIFICATION":
      return "qualification";
    case "PROPOSAL":
      return "proposal";
    case "NEGOTIATION":
      return "negotiation";
    case "WON":
      return "won";
    case "LOST":
      return "lost";
    default:
      return "prospecting";
  }
}

/* ─── Component ──────────────────────────────────────────────────── */

export default function OpportunityDetailPage() {
  const params = useParams();
  const toast = useToast();
  const oppId = params?.id as string | undefined;

  const [opp, setOpp] = useState<OpportunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Won/Lost modal
  const [showWonModal, setShowWonModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [wonLostReason, setWonLostReason] = useState("");

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editData, setEditData] = useState({
    name: "",
    description: "",
    amount: "",
    expectedCloseDate: "",
    contactId: "",
    notes: "",
  });

  /* ─── Load opportunity ────────────────────────────────────────── */

  useEffect(() => {
    if (!oppId) return;

    const load = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/opportunities/${oppId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load opportunity");
        const data = await res.json();
        setOpp(data.data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load opportunity");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [oppId]);

  /* ─── Convert to Quote ────────────────────────────────────────── */

  const handleConvertToQuote = async () => {
    if (!oppId) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/opportunities/${oppId}/convert-to-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to convert to quote");
      }
      const data = await res.json();
      toast.success("Converted to quote successfully");
      // Refresh to get the new convertedQuoteId
      const refreshRes = await apiFetch(`/api/opportunities/${oppId}`, {
        cache: "no-store",
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setOpp(refreshData.data);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to convert to quote");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Mark as Won ─────────────────────────────────────────────── */

  const handleMarkWon = async () => {
    if (!oppId) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/opportunities/${oppId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "WON",
          wonLostReason: wonLostReason || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update opportunity");
      }
      const data = await res.json();
      setOpp(data.data);
      setShowWonModal(false);
      setWonLostReason("");
      toast.success("Opportunity marked as won");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update opportunity");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Mark as Lost ────────────────────────────────────────────── */

  const handleMarkLost = async () => {
    if (!oppId) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/opportunities/${oppId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "LOST",
          wonLostReason: wonLostReason || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update opportunity");
      }
      const data = await res.json();
      setOpp(data.data);
      setShowLostModal(false);
      setWonLostReason("");
      toast.success("Opportunity marked as lost");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update opportunity");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Edit ────────────────────────────────────────────────────── */

  const openEditModal = () => {
    if (!opp) return;
    setEditData({
      name: opp.name,
      description: opp.description || "",
      amount: opp.amount != null ? opp.amount.toString() : "",
      expectedCloseDate: opp.expectedCloseDate
        ? new Date(opp.expectedCloseDate).toISOString().split("T")[0]
        : "",
      contactId: opp.contact?.id || "",
      notes: opp.notes || "",
    });
    setShowEditModal(true);
    // Load contacts for the customer
    if (opp.customer?.id) {
      loadContacts(opp.customer.id);
    }
  };

  const loadContacts = async (customerId: string) => {
    try {
      const res = await apiFetch(`/api/contacts?customerId=${customerId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setContacts(json.data ?? []);
      }
    } catch {
      setContacts([]);
    }
  };

  const handleEdit = async () => {
    if (!oppId) return;
    setActionLoading(true);
    try {
      const body: Record<string, any> = {
        name: editData.name,
      };
      if (editData.description) body.description = editData.description;
      else body.description = null;
      if (editData.amount) body.amount = parseFloat(editData.amount);
      else body.amount = null;
      if (editData.expectedCloseDate)
        body.expectedCloseDate = editData.expectedCloseDate;
      else body.expectedCloseDate = null;
      if (editData.contactId) body.contactId = editData.contactId;
      else body.contactId = null;
      if (editData.notes) body.notes = editData.notes;
      else body.notes = null;

      const res = await apiFetch(`/api/opportunities/${oppId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update opportunity");
      }
      const data = await res.json();
      setOpp(data.data);
      setShowEditModal(false);
      toast.success("Opportunity updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update opportunity");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── Stage stepper logic ─────────────────────────────────────── */

  const getStageIndex = (status: string): number => {
    const idx = STAGES_IN_ORDER.indexOf(status);
    return idx >= 0 ? idx : -1;
  };

  const renderStageStepper = () => {
    if (!opp) return null;
    const isLost = opp.status === "LOST";
    const currentIdx = getStageIndex(opp.status);

    return (
      <div className="opps-info-card">
        <h3>Pipeline Stage</h3>
        <div className="opps-stage-stepper">
          {STAGES_IN_ORDER.map((stage, idx) => {
            let circleClass = "";
            let labelClass = "";
            let lineClass = "";

            if (isLost) {
              // When lost, show the last active stage before lost
              circleClass = "lost";
              labelClass = "lost";
            } else if (idx < currentIdx) {
              circleClass = "completed";
              labelClass = "completed";
              lineClass = "completed";
            } else if (idx === currentIdx) {
              circleClass = "current";
              labelClass = "current";
            }

            // For lost, only highlight stages before qualification (or first stage)
            if (isLost) {
              circleClass = "";
              labelClass = "";
              lineClass = "";
            }

            return (
              <div className="opps-stage-step" key={stage}>
                <div className="opps-stage-node">
                  <div className={`opps-stage-circle ${circleClass}`}>
                    {circleClass === "completed" ? (
                      <CheckCircle size={16} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`opps-stage-label ${labelClass}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                {idx < STAGES_IN_ORDER.length - 1 && (
                  <div className={`opps-stage-line ${lineClass}`} />
                )}
              </div>
            );
          })}
        </div>
        {isLost && (
          <div
            style={{
              textAlign: "center",
              marginTop: 8,
            }}
          >
            <span className="opps-stage-badge lost">
              <XCircle size={14} />
              LOST
            </span>
          </div>
        )}
      </div>
    );
  };

  /* ─── Render guards ───────────────────────────────────────────── */

  if (!oppId)
    return (
      <div className="opps-detail-page">
        <p>Missing opportunity ID.</p>
      </div>
    );

  if (loading)
    return (
      <div className="opps-detail-page">
        <div className="opps-loading">
          <div className="opps-loading-spinner" />
          <span className="opps-loading-text">Loading opportunity...</span>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="opps-detail-page">
        <div className="opps-error">
          <AlertCircle size={18} />
          {error}
        </div>
        <Link href="/sales/opportunities" className="opps-back-link">
          <ArrowLeft size={16} />
          Back to Opportunities
        </Link>
      </div>
    );

  if (!opp)
    return (
      <div className="opps-detail-page">
        <div className="opps-error">
          <AlertCircle size={18} />
          Opportunity not found
        </div>
      </div>
    );

  const canConvert =
    (opp.status === "PROPOSAL" || opp.status === "NEGOTIATION") &&
    !opp.convertedQuoteId;

  const canMarkWonLost =
    opp.status !== "WON" && opp.status !== "LOST";

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <div className="opps-detail-page">
      {/* Header */}
      <div className="opps-detail-header">
        <Link href="/sales/opportunities" className="opps-back-link">
          <ArrowLeft size={16} />
          Back to Opportunities
        </Link>

        <div className="opps-detail-title-row">
          <div>
            <h1 className="opps-detail-title">{opp.name}</h1>
            <div className="opps-detail-meta">
              <span className="opps-customer">
                <User size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {opp.customer?.name || "\u2014"}
              </span>
              <span
                className={`opps-stage-badge ${getStageClass(opp.status)}`}
              >
                {STAGE_LABELS[opp.status] || opp.status}
              </span>
            </div>
          </div>
          <div>
            {opp.amount != null && (
              <span className="opps-amount-large">
                {formatCurrency(parseFloat(opp.amount.toString()))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Won/Lost reason banner */}
      {opp.status === "WON" && opp.wonLostReason && (
        <div className="opps-reason-banner won">
          <CheckCircle size={20} style={{ color: "#065f46", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="reason-label">Won Reason</div>
            <div className="reason-text">{opp.wonLostReason}</div>
          </div>
        </div>
      )}
      {opp.status === "LOST" && opp.wonLostReason && (
        <div className="opps-reason-banner lost">
          <XCircle size={20} style={{ color: "#991b1b", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="reason-label">Lost Reason</div>
            <div className="reason-text">{opp.wonLostReason}</div>
          </div>
        </div>
      )}

      {/* Stage Progression */}
      {renderStageStepper()}

      {/* Action Buttons */}
      <div className="opps-actions-row">
        {canConvert && (
          <button
            className="opps-action-btn convert"
            onClick={handleConvertToQuote}
            disabled={actionLoading}
          >
            <ArrowRightCircle size={18} />
            {actionLoading ? "Converting..." : "Convert to Quote"}
          </button>
        )}

        {opp.convertedQuoteId && opp.convertedQuote && (
          <Link
            href={`/quotes/${opp.convertedQuoteId}`}
            className="opps-quote-link"
          >
            <FileText size={16} />
            Linked Quote: {opp.convertedQuote.quoteNumber}
            <ExternalLink size={14} />
          </Link>
        )}

        {canMarkWonLost && (
          <>
            <button
              className="opps-action-btn won"
              onClick={() => {
                setWonLostReason("");
                setShowWonModal(true);
              }}
              disabled={actionLoading}
            >
              <CheckCircle size={18} />
              Mark as Won
            </button>
            <button
              className="opps-action-btn lost"
              onClick={() => {
                setWonLostReason("");
                setShowLostModal(true);
              }}
              disabled={actionLoading}
            >
              <XCircle size={18} />
              Mark as Lost
            </button>
          </>
        )}

        <button
          className="opps-action-btn edit"
          onClick={openEditModal}
          disabled={actionLoading}
        >
          <Pencil size={16} />
          Edit
        </button>
      </div>

      {/* Info Section */}
      <div className="opps-info-card">
        <h3>Details</h3>
        <div className="opps-info-grid">
          <div className="opps-info-item">
            <span className="opps-info-label">
              <Calendar size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Expected Close Date
            </span>
            <span className="opps-info-value">
              {formatDate(opp.expectedCloseDate)}
            </span>
          </div>

          <div className="opps-info-item">
            <span className="opps-info-label">
              <User size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Contact
            </span>
            <span className={`opps-info-value ${!opp.contact ? "muted" : ""}`}>
              {opp.contact
                ? `${opp.contact.firstName} ${opp.contact.lastName}`
                : "No contact assigned"}
            </span>
          </div>

          <div className="opps-info-item">
            <span className="opps-info-label">
              <User size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Created By
            </span>
            <span className="opps-info-value">
              {opp.createdBy?.name || "\u2014"}
            </span>
          </div>

          <div className="opps-info-item">
            <span className="opps-info-label">
              <Clock size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Created
            </span>
            <span className="opps-info-value">
              {formatDate(opp.createdAt)}
            </span>
          </div>

          {opp.wonLostAt && (
            <div className="opps-info-item">
              <span className="opps-info-label">
                {opp.status === "WON" ? "Won Date" : "Lost Date"}
              </span>
              <span className="opps-info-value">
                {formatDate(opp.wonLostAt)}
              </span>
            </div>
          )}

          {opp.site && (
            <div className="opps-info-item">
              <span className="opps-info-label">Site</span>
              <span className="opps-info-value">{opp.site.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {opp.description && (
        <div className="opps-info-card">
          <h3>Description</h3>
          <p className="opps-description-text">{opp.description}</p>
        </div>
      )}

      {/* Notes */}
      {opp.notes && (
        <div className="opps-info-card">
          <h3>
            <StickyNote size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Notes
          </h3>
          <p className="opps-notes-text">{opp.notes}</p>
        </div>
      )}

      {/* ─── Mark as Won Modal ──────────────────────────────────── */}
      {showWonModal && (
        <div
          className="opps-modal-overlay"
          onClick={() => setShowWonModal(false)}
        >
          <div className="opps-modal" onClick={(e) => e.stopPropagation()}>
            <div className="opps-modal-header">
              <h3 className="opps-modal-title">Mark as Won</h3>
              <button
                className="opps-modal-close"
                onClick={() => setShowWonModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="opps-modal-body">
              <div className="opps-form-field">
                <label className="opps-form-label">
                  Why was this opportunity won?
                </label>
                <textarea
                  className="opps-form-textarea"
                  rows={4}
                  placeholder="e.g., Competitive pricing, existing relationship, superior service capabilities..."
                  value={wonLostReason}
                  onChange={(e) => setWonLostReason(e.target.value)}
                />
              </div>
            </div>
            <div className="opps-modal-footer">
              <button
                className="opps-btn-cancel"
                onClick={() => setShowWonModal(false)}
              >
                Cancel
              </button>
              <button
                className="opps-btn-submit green"
                onClick={handleMarkWon}
                disabled={actionLoading}
              >
                <CheckCircle size={16} />
                {actionLoading ? "Updating..." : "Confirm Won"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Mark as Lost Modal ─────────────────────────────────── */}
      {showLostModal && (
        <div
          className="opps-modal-overlay"
          onClick={() => setShowLostModal(false)}
        >
          <div className="opps-modal" onClick={(e) => e.stopPropagation()}>
            <div className="opps-modal-header">
              <h3 className="opps-modal-title">Mark as Lost</h3>
              <button
                className="opps-modal-close"
                onClick={() => setShowLostModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="opps-modal-body">
              <div className="opps-form-field">
                <label className="opps-form-label">
                  Why was this opportunity lost?
                </label>
                <textarea
                  className="opps-form-textarea"
                  rows={4}
                  placeholder="e.g., Price too high, went with competitor, project cancelled..."
                  value={wonLostReason}
                  onChange={(e) => setWonLostReason(e.target.value)}
                />
              </div>
            </div>
            <div className="opps-modal-footer">
              <button
                className="opps-btn-cancel"
                onClick={() => setShowLostModal(false)}
              >
                Cancel
              </button>
              <button
                className="opps-btn-submit red"
                onClick={handleMarkLost}
                disabled={actionLoading}
              >
                <XCircle size={16} />
                {actionLoading ? "Updating..." : "Confirm Lost"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Modal ─────────────────────────────────────────── */}
      {showEditModal && (
        <div
          className="opps-modal-overlay"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="opps-modal wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="opps-modal-header">
              <h3 className="opps-modal-title">Edit Opportunity</h3>
              <button
                className="opps-modal-close"
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="opps-modal-body">
              <div className="opps-form-grid">
                {/* Name */}
                <div className="opps-form-field full-width">
                  <label className="opps-form-label">
                    Opportunity Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="opps-form-input"
                    value={editData.name}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Description */}
                <div className="opps-form-field full-width">
                  <label className="opps-form-label">Description</label>
                  <textarea
                    className="opps-form-textarea"
                    rows={3}
                    value={editData.description}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Amount */}
                <div className="opps-form-field">
                  <label className="opps-form-label">
                    <DollarSign
                      size={14}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    Amount
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="opps-form-input"
                    placeholder="0.00"
                    value={editData.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setEditData((prev) => ({ ...prev, amount: value }));
                      }
                    }}
                  />
                </div>

                {/* Expected Close Date */}
                <div className="opps-form-field">
                  <label className="opps-form-label">
                    <Calendar
                      size={14}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    className="opps-form-input"
                    value={editData.expectedCloseDate}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        expectedCloseDate: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Contact */}
                <div className="opps-form-field">
                  <label className="opps-form-label">Contact</label>
                  <select
                    className="opps-form-select"
                    value={editData.contactId}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        contactId: e.target.value,
                      }))
                    }
                  >
                    <option value="">No contact</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="opps-form-field full-width">
                  <label className="opps-form-label">
                    <StickyNote
                      size={14}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    Notes
                  </label>
                  <textarea
                    className="opps-form-textarea"
                    rows={4}
                    placeholder="Internal notes..."
                    value={editData.notes}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <div className="opps-modal-footer">
              <button
                className="opps-btn-cancel"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                className="opps-btn-submit"
                onClick={handleEdit}
                disabled={actionLoading || !editData.name}
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
