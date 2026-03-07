"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Ticket,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  User,
  Building2,
} from "lucide-react";
import "./service-tickets.css";

type ServiceTicket = {
  id: string;
  ticketNumber: string | null;
  status: string;
  urgency: string;
  reason: string;
  requestedDate: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  contact: { id: string; name: string | null; email: string } | null;
  site: { id: string; name: string } | null;
  createdByUser: { id: string; name: string | null; email: string } | null;
};

type StatusTab = "ALL" | "OPEN" | "ASSIGNED" | "CONVERTED" | "CLOSED";

const STATUS_TABS: StatusTab[] = ["ALL", "OPEN", "ASSIGNED", "CONVERTED", "CLOSED"];
const PAGE_SIZE = 50;

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

function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ServiceTicketsPage() {
  const router = useRouter();
  const toast = useToast();
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusTab>("ALL");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadTickets = useCallback(
    async (offset = 0, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(offset));
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (searchTerm) params.set("search", searchTerm);

        const res = await apiFetch(`/api/service-tickets?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load service tickets");

        const data = await res.json();
        const items = data.data ?? [];

        if (append) {
          setTickets((prev) => [...prev, ...items]);
        } else {
          setTickets(items);
        }
        setTotal(data.total ?? items.length);
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? "Failed to load service tickets";
        setError(msg);
        if (!append) toast.error(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, searchTerm, toast]
  );

  useEffect(() => {
    loadTickets(0, false);
  }, [loadTickets]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleLoadMore = () => {
    loadTickets(tickets.length, true);
  };

  const hasMore = tickets.length < total;

  return (
    <div className="st-page">
      {/* Page Header */}
      <div className="st-page-header">
        <div className="st-page-header-left">
          <h1>Service Tickets</h1>
          <p className="st-page-subtitle">
            Track and manage incoming service requests
          </p>
        </div>
        <div className="st-page-header-right">
          <button
            className="st-create-btn"
            onClick={() => router.push("/sales/service-tickets/new")}
          >
            <Plus size={18} />
            New Ticket
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="st-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Search + Filter Toolbar */}
      <div className="st-toolbar">
        <div className="st-search-row">
          <div className="st-search-wrapper">
            <span className="st-search-icon">
              <Search size={18} />
            </span>
            <input
              type="text"
              className="st-search-input"
              placeholder="Search by customer or reason..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="st-filter-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                className={`st-filter-tab ${statusFilter === tab ? "active" : ""}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab === "ALL"
                  ? "All"
                  : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="st-results-count">
          Showing <strong>{tickets.length}</strong> of{" "}
          <strong>{total}</strong> tickets
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="st-loading">
          <div className="st-loading-spinner" />
          <span className="st-loading-text">Loading service tickets...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && tickets.length === 0 && (
        <div className="st-empty">
          <div className="st-empty-icon">
            <Ticket size={48} />
          </div>
          <h3>
            {searchTerm || statusFilter !== "ALL"
              ? "No tickets match your filters"
              : "No service tickets yet"}
          </h3>
          <p>
            {searchTerm || statusFilter !== "ALL"
              ? "Try adjusting your search term or status filter."
              : "Create a new service ticket to track incoming service requests from customers."}
          </p>
          {!searchTerm && statusFilter === "ALL" && (
            <button
              className="st-empty-btn"
              onClick={() => router.push("/sales/service-tickets/new")}
            >
              <Plus size={18} />
              New Ticket
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      {!loading && tickets.length > 0 && (
        <>
          <div className="st-table-card">
            <table className="st-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Requested Date</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() =>
                      router.push(`/sales/service-tickets/${ticket.id}`)
                    }
                  >
                    <td>
                      <div className="st-customer-cell">
                        <Building2 size={14} className="st-cell-icon" />
                        <span className="st-customer-name">
                          {ticket.customer?.name || "No customer"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="st-reason-text">
                        {truncate(ticket.reason, 60)}
                      </span>
                    </td>
                    <td>
                      <span
                        className="st-badge"
                        style={{
                          background:
                            (URGENCY_COLORS[ticket.urgency] || "#6b7280") + "1a",
                          color: URGENCY_COLORS[ticket.urgency] || "#6b7280",
                          borderColor:
                            (URGENCY_COLORS[ticket.urgency] || "#6b7280") + "33",
                        }}
                      >
                        {ticket.urgency}
                      </span>
                    </td>
                    <td>
                      <span
                        className="st-badge"
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
                    </td>
                    <td>
                      <span className="st-date">
                        {formatDate(ticket.requestedDate)}
                      </span>
                    </td>
                    <td>
                      <div className="st-created-by-cell">
                        <User size={14} className="st-cell-icon" />
                        <span>
                          {ticket.createdByUser?.name ||
                            ticket.createdByUser?.email ||
                            "\u2014"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="st-load-more-row">
              <button
                className="st-load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Loading..."
                  : `Load More (${total - tickets.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
