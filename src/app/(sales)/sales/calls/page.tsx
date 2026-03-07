"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Phone,
  Plus,
  AlertCircle,
  CalendarClock,
  Target,
  PhoneCall,
} from "lucide-react";
import "./calls.css";

type CallLog = {
  id: string;
  callTimestamp: string;
  durationMinutes: number | null;
  callMethod: string;
  competitorMentioned: string | null;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  contact: { id: string; firstName: string; lastName: string } | null;
  callType: { id: string; name: string } | null;
  callOutcome: {
    id: string;
    name: string;
    triggersFollowUp: boolean;
    triggersOpportunityPrompt: boolean;
  } | null;
};

type Customer = {
  id: string;
  name: string;
};

const PAGE_SIZE = 50;

export default function CallLogPage() {
  const router = useRouter();
  const toast = useToast();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Load customers for filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/customers?limit=500");
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.data ?? []);
        }
      } catch {
        // Non-critical, filter just won't work
      }
    })();
  }, []);

  const loadCalls = useCallback(
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
        if (dateStart) params.set("dateStart", dateStart);
        if (dateEnd) params.set("dateEnd", dateEnd);
        if (customerFilter) params.set("customerId", customerFilter);

        const res = await apiFetch(`/api/call-logs?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load call logs");

        const data = await res.json();
        const items = data.data ?? [];

        if (append) {
          setCalls((prev) => [...prev, ...items]);
        } else {
          setCalls(items);
        }
        setTotal(data.total ?? items.length);
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? "Failed to load call logs";
        setError(msg);
        if (!append) toast.error(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [dateStart, dateEnd, customerFilter, toast]
  );

  useEffect(() => {
    loadCalls(0, false);
  }, [loadCalls]);

  const handleLoadMore = () => {
    loadCalls(calls.length, true);
  };

  const hasMore = calls.length < total;

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = calls.filter(
      (c) => c.callTimestamp?.slice(0, 10) === today
    ).length;
    const followUpCount = calls.filter(
      (c) => c.callOutcome?.triggersFollowUp
    ).length;
    return { totalCount: total, todayCount, followUpCount };
  }, [calls, total]);

  const formatDuration = (minutes: number | null): string => {
    if (minutes == null || minutes === 0) return "\u2014";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatContactName = (contact: CallLog["contact"]): string => {
    if (!contact) return "\u2014";
    return `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "\u2014";
  };

  const formatMethod = (method: string): string => {
    switch (method) {
      case "PHONE": return "Phone";
      case "IN_PERSON": return "In Person";
      case "VIDEO_CALL": return "Video";
      case "EMAIL": return "Email";
      default: return method;
    }
  };

  return (
    <div className="calls-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Call Log</h1>
          <p className="page-subtitle">
            Track customer interactions, follow-ups, and sales opportunities
          </p>
        </div>
        <div className="page-header-right">
          <div className="calls-header-actions">
            <button
              className="calls-create-btn"
              onClick={() => router.push("/sales/calls/new")}
            >
              <Plus size={18} />
              Log a Call
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="calls-error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="calls-stats-grid">
        <div className="calls-stat-card total">
          <div className="calls-stat-icon total">
            <Phone size={22} />
          </div>
          <div className="calls-stat-info">
            <span className="calls-stat-value">{stats.totalCount}</span>
            <span className="calls-stat-label">Total Calls</span>
          </div>
        </div>

        <div className="calls-stat-card today">
          <div className="calls-stat-icon today">
            <PhoneCall size={22} />
          </div>
          <div className="calls-stat-info">
            <span className="calls-stat-value">{stats.todayCount}</span>
            <span className="calls-stat-label">Today</span>
          </div>
        </div>

        <div className="calls-stat-card followups">
          <div className="calls-stat-icon followups">
            <CalendarClock size={22} />
          </div>
          <div className="calls-stat-info">
            <span className="calls-stat-value">{stats.followUpCount}</span>
            <span className="calls-stat-label">Follow-ups Triggered</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="calls-toolbar">
        <div className="calls-filter-row">
          <div className="calls-filter-group">
            <label>Start Date</label>
            <input
              type="date"
              className="calls-filter-input"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </div>
          <div className="calls-filter-group">
            <label>End Date</label>
            <input
              type="date"
              className="calls-filter-input"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>
          <div className="calls-filter-group">
            <label>Customer</label>
            <select
              className="calls-filter-select"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="calls-results-count">
          Showing <strong>{calls.length}</strong> of{" "}
          <strong>{total}</strong> calls
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="calls-loading">
          <div className="calls-loading-spinner" />
          <span className="calls-loading-text">Loading call logs...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && calls.length === 0 && (
        <div className="calls-empty">
          <div className="calls-empty-icon">
            <Phone size={48} />
          </div>
          <h3>
            {dateStart || dateEnd || customerFilter
              ? "No calls match your filters"
              : "No calls logged yet"}
          </h3>
          <p>
            {dateStart || dateEnd || customerFilter
              ? "Try adjusting your date range or customer filter."
              : "Start logging customer calls to track interactions and build your sales pipeline."}
          </p>
          {!dateStart && !dateEnd && !customerFilter && (
            <button
              className="calls-empty-btn"
              onClick={() => router.push("/sales/calls/new")}
            >
              <Plus size={18} />
              Log a Call
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      {!loading && calls.length > 0 && (
        <>
          <div className="calls-table-card">
            <table className="calls-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Outcome</th>
                  <th>Method</th>
                  <th>Duration</th>
                  <th>Date / Time</th>
                  <th>Triggers</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id}>
                    <td>
                      <span className="calls-customer-name">
                        {call.customer?.name ?? "\u2014"}
                      </span>
                    </td>
                    <td>
                      <span className="calls-contact-name">
                        {formatContactName(call.contact)}
                      </span>
                    </td>
                    <td>
                      <span className="calls-type-badge">
                        {call.callType?.name ?? "\u2014"}
                      </span>
                    </td>
                    <td>
                      <span className="calls-outcome-badge">
                        {call.callOutcome?.name ?? "\u2014"}
                      </span>
                    </td>
                    <td>
                      <span className="calls-method-badge">
                        {formatMethod(call.callMethod)}
                      </span>
                    </td>
                    <td>
                      <span className="calls-duration">
                        {formatDuration(call.durationMinutes)}
                      </span>
                    </td>
                    <td>
                      <span className="calls-date">
                        {formatDateTime(call.callTimestamp)}
                      </span>
                    </td>
                    <td>
                      <div className="calls-triggers">
                        {call.callOutcome?.triggersFollowUp && (
                          <span
                            className="calls-trigger-icon follow-up"
                            title="Triggers follow-up"
                          >
                            <CalendarClock size={14} />
                          </span>
                        )}
                        {call.callOutcome?.triggersOpportunityPrompt && (
                          <span
                            className="calls-trigger-icon opportunity"
                            title="Triggers opportunity prompt"
                          >
                            <Target size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <button
                className="btn-secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? "Loading..."
                  : `Load More (${total - calls.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
