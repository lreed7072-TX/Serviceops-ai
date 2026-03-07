"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ArrowLeft,
  Building2,
  MapPin,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  Zap,
  ClipboardList,
  XCircle,
  ExternalLink,
} from "lucide-react";
import "../service-tickets.css";

type ServiceTicketDetail = {
  id: string;
  ticketNumber: string | null;
  status: string;
  urgency: string;
  reason: string;
  notes: string | null;
  siteAddress: string | null;
  requestedDate: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string } | null;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  site: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  createdByUser: { id: string; name: string | null; email: string } | null;
  convertedWorkOrder: {
    id: string;
    workOrderNumber: string | null;
    title: string;
  } | null;
};

const URGENCY_COLORS: Record<string, string> = {
  LOW: "#6b7280",
  NORMAL: "#3b82f6",
  HIGH: "#f59e0b",
  EMERGENCY: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#3b82f6",
  ASSIGNED: "#f59e0b",
  CONVERTED: "#10b981",
  CLOSED: "#6b7280",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ServiceTicketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const [ticket, setTicket] = useState<ServiceTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);

  const ticketId = params?.id;

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const fetchTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/service-tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to load service ticket");
      const data = await res.json();
      setTicket(data.data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load service ticket");
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToWorkOrder = async () => {
    if (!ticketId) return;
    setConverting(true);
    try {
      const res = await apiFetch(
        `/api/service-tickets/${ticketId}/convert-to-work-order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to convert to work order");
      }
      const data = await res.json();
      const woNumber =
        data.data?.workOrderNumber ||
        data.data?.workOrder?.workOrderNumber ||
        "new work order";
      toast.success(`Converted to Work Order ${woNumber}`);
      await fetchTicket();
    } catch (e: any) {
      toast.error(e?.message || "Failed to convert to work order");
    } finally {
      setConverting(false);
      setShowConvertConfirm(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!ticketId) return;
    setClosing(true);
    try {
      const res = await apiFetch(`/api/service-tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to close ticket");
      }
      toast.success("Service ticket closed");
      await fetchTicket();
    } catch (e: any) {
      toast.error(e?.message || "Failed to close ticket");
    } finally {
      setClosing(false);
      setShowCloseConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="st-page">
        <div className="st-loading">
          <div className="st-loading-spinner" />
          <span className="st-loading-text">Loading service ticket...</span>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="st-page">
        <div className="st-empty">
          <h3>Service ticket not found</h3>
          <Link href="/sales/service-tickets" className="st-back-link">
            <ArrowLeft size={16} />
            Back to Service Tickets
          </Link>
        </div>
      </div>
    );
  }

  const canConvert =
    ticket.status === "OPEN" || ticket.status === "ASSIGNED";
  const canClose =
    ticket.status !== "CLOSED" && ticket.status !== "CONVERTED";

  return (
    <div className="st-page">
      {/* Back Link */}
      <Link href="/sales/service-tickets" className="st-back-link">
        <ArrowLeft size={16} />
        Back to Service Tickets
      </Link>

      {/* Detail Header */}
      <div className="st-detail-header">
        <div className="st-detail-header-left">
          <h1 className="st-detail-title">
            {ticket.ticketNumber || `ST-${ticket.id.slice(0, 8).toUpperCase()}`}
          </h1>
          <div className="st-detail-customer">
            <Building2 size={16} />
            {ticket.customer?.name || "No customer"}
          </div>
        </div>
        <div className="st-detail-header-right">
          <span
            className="st-detail-badge"
            style={{
              background:
                (URGENCY_COLORS[ticket.urgency] || "#6b7280") + "1a",
              color: URGENCY_COLORS[ticket.urgency] || "#6b7280",
              borderColor:
                (URGENCY_COLORS[ticket.urgency] || "#6b7280") + "33",
            }}
          >
            <AlertTriangle size={14} />
            {ticket.urgency}
          </span>
          <span
            className="st-detail-badge"
            style={{
              background:
                (STATUS_COLORS[ticket.status] || "#6b7280") + "1a",
              color: STATUS_COLORS[ticket.status] || "#6b7280",
              borderColor:
                (STATUS_COLORS[ticket.status] || "#6b7280") + "33",
            }}
          >
            {ticket.status}
          </span>
        </div>
      </div>

      {/* Converted Work Order Banner */}
      {ticket.status === "CONVERTED" && ticket.convertedWorkOrder && (
        <div className="st-converted-banner">
          <ClipboardList size={18} />
          <span>
            Converted to Work Order:{" "}
            <Link
              href={`/work-orders/${ticket.convertedWorkOrder.id}`}
              className="st-wo-link"
            >
              {ticket.convertedWorkOrder.workOrderNumber ||
                `WO-${ticket.convertedWorkOrder.id.slice(0, 8).toUpperCase()}`}
              <ExternalLink size={14} />
            </Link>
          </span>
        </div>
      )}

      {/* Detail Sections */}
      <div className="st-detail-grid">
        {/* Reason for Service */}
        <div className="st-detail-section st-detail-section-full">
          <h3 className="st-detail-section-title">
            <FileText size={16} />
            Reason for Service
          </h3>
          <div className="st-detail-section-body">
            <p className="st-detail-text">{ticket.reason}</p>
          </div>
        </div>

        {/* Notes */}
        {ticket.notes && (
          <div className="st-detail-section st-detail-section-full">
            <h3 className="st-detail-section-title">
              <FileText size={16} />
              Notes
            </h3>
            <div className="st-detail-section-body">
              <p className="st-detail-text">{ticket.notes}</p>
            </div>
          </div>
        )}

        {/* Contact Info */}
        {ticket.contact && (
          <div className="st-detail-section">
            <h3 className="st-detail-section-title">
              <User size={16} />
              Contact Information
            </h3>
            <div className="st-detail-section-body">
              <div className="st-detail-info-list">
                {ticket.contact.name && (
                  <div className="st-detail-info-item">
                    <User size={14} className="st-detail-info-icon" />
                    <span>{ticket.contact.name}</span>
                  </div>
                )}
                {ticket.contact.email && (
                  <div className="st-detail-info-item">
                    <Mail size={14} className="st-detail-info-icon" />
                    <a
                      href={`mailto:${ticket.contact.email}`}
                      className="st-detail-link"
                    >
                      {ticket.contact.email}
                    </a>
                  </div>
                )}
                {ticket.contact.phone && (
                  <div className="st-detail-info-item">
                    <Phone size={14} className="st-detail-info-icon" />
                    <a
                      href={`tel:${ticket.contact.phone}`}
                      className="st-detail-link"
                    >
                      {ticket.contact.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Site Info */}
        <div className="st-detail-section">
          <h3 className="st-detail-section-title">
            <MapPin size={16} />
            Site Information
          </h3>
          <div className="st-detail-section-body">
            <div className="st-detail-info-list">
              {ticket.site && (
                <div className="st-detail-info-item">
                  <Building2 size={14} className="st-detail-info-icon" />
                  <span>{ticket.site.name}</span>
                </div>
              )}
              {(ticket.siteAddress || ticket.site?.address) && (
                <div className="st-detail-info-item">
                  <MapPin size={14} className="st-detail-info-icon" />
                  <span>
                    {ticket.siteAddress ||
                      [
                        ticket.site?.address,
                        ticket.site?.city,
                        ticket.site?.state,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                  </span>
                </div>
              )}
              {!ticket.site && !ticket.siteAddress && (
                <div className="st-detail-info-empty">
                  No site information provided
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Requested Date */}
        <div className="st-detail-section">
          <h3 className="st-detail-section-title">
            <Calendar size={16} />
            Requested Date
          </h3>
          <div className="st-detail-section-body">
            <div className="st-detail-info-item">
              <Calendar size={14} className="st-detail-info-icon" />
              <span>{formatDate(ticket.requestedDate)}</span>
            </div>
          </div>
        </div>

        {/* Created By / Date */}
        <div className="st-detail-section">
          <h3 className="st-detail-section-title">
            <Clock size={16} />
            Ticket Info
          </h3>
          <div className="st-detail-section-body">
            <div className="st-detail-info-list">
              <div className="st-detail-info-item">
                <User size={14} className="st-detail-info-icon" />
                <span>
                  Created by{" "}
                  {ticket.createdByUser?.name ||
                    ticket.createdByUser?.email ||
                    "Unknown"}
                </span>
              </div>
              <div className="st-detail-info-item">
                <Clock size={14} className="st-detail-info-icon" />
                <span>Created {formatDateTime(ticket.createdAt)}</span>
              </div>
              <div className="st-detail-info-item">
                <Clock size={14} className="st-detail-info-icon" />
                <span>Updated {formatDateTime(ticket.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="st-detail-actions">
        <h3 className="st-detail-actions-title">
          <Zap size={16} />
          Actions
        </h3>
        <div className="st-detail-actions-grid">
          {canConvert && (
            <button
              className="st-action-btn st-action-convert"
              onClick={() => setShowConvertConfirm(true)}
              disabled={converting}
            >
              <ClipboardList size={16} />
              {converting ? "Converting..." : "Convert to Work Order"}
            </button>
          )}

          {canClose && (
            <button
              className="st-action-btn st-action-close"
              onClick={() => setShowCloseConfirm(true)}
              disabled={closing}
            >
              <XCircle size={16} />
              {closing ? "Closing..." : "Close Ticket"}
            </button>
          )}
        </div>
      </div>

      {/* Confirm Convert Dialog */}
      <ConfirmDialog
        open={showConvertConfirm}
        onClose={() => setShowConvertConfirm(false)}
        onConfirm={handleConvertToWorkOrder}
        title="Convert to Work Order"
        message="Create a new work order from this service ticket?"
        detail="The ticket status will be changed to CONVERTED and a new work order will be created with the customer, site, and service details."
        confirmLabel="Convert"
        variant="default"
        loading={converting}
      />

      {/* Confirm Close Dialog */}
      <ConfirmDialog
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleCloseTicket}
        title="Close Service Ticket"
        message="Are you sure you want to close this service ticket?"
        detail="Closed tickets cannot be converted to work orders."
        confirmLabel="Close Ticket"
        variant="warning"
        loading={closing}
      />
    </div>
  );
}
