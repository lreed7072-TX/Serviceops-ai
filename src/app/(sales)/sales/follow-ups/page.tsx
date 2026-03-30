"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  CalendarClock,
  Plus,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Flame,
  Filter,
  User,
} from "lucide-react";
import "./follow-ups.css";

// ─── Types ──────────────────────────────────────────────────────

type FollowUp = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  priority: "HOT" | "NORMAL" | "LOW";
  status: "PENDING" | "COMPLETED";
  completedAt: string | null;
  createdAt: string;
  customer: { name: string };
  contact: { firstName: string; lastName: string } | null;
  assignedTo: { name: string };
};

type CustomerOption = {
  id: string;
  name: string;
};

type ContactOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type StatusTab = "ALL" | "PENDING" | "COMPLETED";

const STATUS_TABS: StatusTab[] = ["ALL", "PENDING", "COMPLETED"];
const PAGE_SIZE = 50;

// ─── Helpers ────────────────────────────────────────────────────

function formatRelativeDueDate(dateStr: string, status: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (status === "COMPLETED") {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return abs === 1 ? "1 day overdue" : `${abs} days overdue`;
  }
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === "COMPLETED") return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < now;
}

// ─── Component ──────────────────────────────────────────────────

export default function FollowUpsPage() {
  const toast = useToast();

  // List state
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusTab>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Create modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPriority, setFormPriority] = useState<"HOT" | "NORMAL" | "LOW">("NORMAL");
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formContactId, setFormContactId] = useState("");

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const customerSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Contact options (filtered by customer)
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Completing
  const [completingId, setCompletingId] = useState<string | null>(null);

  // ─── Load follow-ups ──────────────────────────────────────────

  const loadFollowUps = useCallback(
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
        if (priorityFilter !== "ALL") params.set("priority", priorityFilter);

        const res = await apiFetch(`/api/follow-ups?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load follow-ups");

        const data = await res.json();
        const items: FollowUp[] = data.data ?? [];

        if (append) {
          setFollowUps((prev) => [...prev, ...items]);
        } else {
          setFollowUps(items);
        }
        setTotal(data.total ?? items.length);
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? "Failed to load follow-ups";
        setError(msg);
        if (!append) toast.error(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [statusFilter, priorityFilter, toast]
  );

  useEffect(() => {
    loadFollowUps(0, false);
  }, [loadFollowUps]);

  const handleLoadMore = () => {
    loadFollowUps(followUps.length, true);
  };

  const hasMore = followUps.length < total;

  // ─── Complete follow-up ───────────────────────────────────────

  const handleComplete = async (id: string) => {
    try {
      setCompletingId(id);
      const res = await apiFetch(`/api/follow-ups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Failed to complete follow-up");
      toast.success("Follow-up marked as completed");
      loadFollowUps(0, false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to complete follow-up");
    } finally {
      setCompletingId(null);
    }
  };

  // ─── Customer search ──────────────────────────────────────────

  const searchCustomers = async (term: string) => {
    if (!term || term.length < 2) {
      setCustomerOptions([]);
      setShowCustomerDropdown(false);
      return;
    }
    try {
      const res = await apiFetch(`/api/customers?limit=20&offset=0`);
      if (!res.ok) return;
      const json = await res.json();
      const all: CustomerOption[] = (json.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
      }));
      // Client-side filter since the API doesn't support search param
      const filtered = all.filter((c) =>
        c.name.toLowerCase().includes(term.toLowerCase())
      );
      setCustomerOptions(filtered);
      setShowCustomerDropdown(filtered.length > 0);
    } catch {
      // silent
    }
  };

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setSelectedCustomerName("");
    setFormCustomerId("");
    setFormContactId("");
    setContactOptions([]);

    if (customerSearchTimeout.current) {
      clearTimeout(customerSearchTimeout.current);
    }
    customerSearchTimeout.current = setTimeout(() => {
      searchCustomers(value);
    }, 300);
  };

  const selectCustomer = (customer: CustomerOption) => {
    setFormCustomerId(customer.id);
    setSelectedCustomerName(customer.name);
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
    setFormContactId("");
    loadContacts(customer.id);
  };

  // ─── Load contacts for selected customer ──────────────────────

  const loadContacts = async (customerId: string) => {
    try {
      setLoadingContacts(true);
      const res = await apiFetch(
        `/api/contacts?customerId=${customerId}&limit=50&offset=0`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = await res.json();
      setContactOptions(
        (json.data ?? []).map((c: any) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
        }))
      );
    } catch {
      // silent
    } finally {
      setLoadingContacts(false);
    }
  };

  // ─── Create follow-up ─────────────────────────────────────────

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormDueDate("");
    setFormPriority("NORMAL");
    setFormCustomerId("");
    setFormContactId("");
    setCustomerSearch("");
    setSelectedCustomerName("");
    setCustomerOptions([]);
    setContactOptions([]);
    setShowCustomerDropdown(false);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (!formDueDate) {
      toast.error("Due date is required");
      return;
    }

    try {
      setCreating(true);
      const body: any = {
        title: formTitle.trim(),
        customerId: formCustomerId,
        dueDate: formDueDate,
        priority: formPriority,
        // assignedToUserId is required by the API — the server will use the
        // current session's userId. We send a placeholder that the API will
        // validate. For self-assignment, we rely on the fact that SALES users
        // can only create follow-ups for themselves. For ADMIN, we also
        // self-assign here. A proper user picker can be added later.
        assignedToUserId: "SELF",
      };
      if (formDescription.trim()) {
        body.description = formDescription.trim();
      }
      if (formContactId) {
        body.contactId = formContactId;
      }

      // First, get the current user's ID
      const meRes = await apiFetch("/api/auth/me", { cache: "no-store" });
      if (meRes.ok) {
        const meJson = await meRes.json();
        body.assignedToUserId = meJson.data?.id ?? meJson.id ?? meJson.userId;
      }

      const res = await apiFetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? "Failed to create follow-up");
      }

      toast.success("Follow-up created");
      setShowModal(false);
      resetForm();
      loadFollowUps(0, false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create follow-up");
    } finally {
      setCreating(false);
    }
  };

  // ─── Stats ────────────────────────────────────────────────────

  const pendingCount = followUps.filter((f) => f.status === "PENDING").length;
  const overdueCount = followUps.filter(
    (f) => f.status === "PENDING" && isOverdue(f.dueDate, f.status)
  ).length;
  const completedCount = followUps.filter((f) => f.status === "COMPLETED").length;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="followups-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Follow-ups</h1>
          <p className="page-subtitle">
            Track and manage customer follow-up tasks
          </p>
        </div>
        <div className="page-header-right">
          <button
            className="followups-create-btn"
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} />
            New Follow-up
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="followups-error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="followups-stats-grid">
        <div className="followups-stat-card total">
          <div className="followups-stat-icon total">
            <CalendarClock size={22} />
          </div>
          <div className="followups-stat-info">
            <span className="followups-stat-value">{total}</span>
            <span className="followups-stat-label">Total</span>
          </div>
        </div>

        <div className="followups-stat-card pending">
          <div className="followups-stat-icon pending">
            <Clock size={22} />
          </div>
          <div className="followups-stat-info">
            <span className="followups-stat-value">{pendingCount}</span>
            <span className="followups-stat-label">Pending</span>
          </div>
        </div>

        <div className="followups-stat-card overdue">
          <div className="followups-stat-icon overdue">
            <AlertCircle size={22} />
          </div>
          <div className="followups-stat-info">
            <span className="followups-stat-value">{overdueCount}</span>
            <span className="followups-stat-label">Overdue</span>
          </div>
        </div>

        <div className="followups-stat-card completed">
          <div className="followups-stat-icon completed">
            <CheckCircle size={22} />
          </div>
          <div className="followups-stat-info">
            <span className="followups-stat-value">{completedCount}</span>
            <span className="followups-stat-label">Completed</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="followups-toolbar">
        <div className="followups-filter-row">
          {/* Status Tabs */}
          <div className="followups-filter-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                className={`followups-filter-tab ${statusFilter === tab ? "active" : ""}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab === "ALL"
                  ? "All"
                  : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
          <div className="followups-priority-filter">
            <Filter size={16} />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="followups-priority-select"
            >
              <option value="ALL">All Priorities</option>
              <option value="HOT">Hot</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
        <div className="followups-results-count">
          Showing <strong>{followUps.length}</strong> of{" "}
          <strong>{total}</strong> follow-ups
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="followups-loading">
          <div className="followups-loading-spinner" />
          <span className="followups-loading-text">Loading follow-ups...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && followUps.length === 0 && (
        <div className="followups-empty">
          <div className="followups-empty-icon">
            <CalendarClock size={48} />
          </div>
          <h3>
            {statusFilter !== "ALL" || priorityFilter !== "ALL"
              ? "No follow-ups match your filters"
              : "No follow-ups yet"}
          </h3>
          <p>
            {statusFilter !== "ALL" || priorityFilter !== "ALL"
              ? "Try adjusting your status or priority filter."
              : "Create follow-ups to track tasks for your customers and never miss a deadline."}
          </p>
          {statusFilter === "ALL" && priorityFilter === "ALL" && (
            <button
              className="followups-empty-btn"
              onClick={() => setShowModal(true)}
            >
              <Plus size={18} />
              New Follow-up
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      {!loading && followUps.length > 0 && (
        <>
          <div className="followups-table-card">
            <table className="followups-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {followUps.map((fu) => {
                  const overdue = isOverdue(fu.dueDate, fu.status);
                  return (
                    <tr
                      key={fu.id}
                      className={overdue ? "followups-row-overdue" : ""}
                    >
                      <td>
                        <span className="followups-title">{fu.title}</span>
                      </td>
                      <td>
                        <span className="followups-customer">
                          {fu.customer?.name ?? "\u2014"}
                        </span>
                      </td>
                      <td>
                        <span className="followups-contact">
                          {fu.contact
                            ? `${fu.contact.firstName} ${fu.contact.lastName}`
                            : "\u2014"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`followups-due ${overdue ? "followups-due--overdue" : ""}`}
                        >
                          {formatRelativeDueDate(fu.dueDate, fu.status)}
                          {overdue && (
                            <span className="followups-overdue-label">
                              Overdue
                            </span>
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`followups-priority-badge followups-priority-badge--${fu.priority.toLowerCase()}`}
                        >
                          {fu.priority === "HOT" && <Flame size={12} />}
                          {fu.priority}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`followups-status-badge followups-status-badge--${fu.status.toLowerCase()}`}
                        >
                          {fu.status === "COMPLETED"
                            ? "Completed"
                            : "Pending"}
                        </span>
                      </td>
                      <td>
                        <span className="followups-assigned">
                          <User size={14} />
                          {fu.assignedTo?.name ?? "\u2014"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="followups-actions">
                          {fu.status === "PENDING" && (
                            <button
                              className="followups-complete-btn"
                              onClick={() => handleComplete(fu.id)}
                              disabled={completingId === fu.id}
                            >
                              <CheckCircle size={14} />
                              {completingId === fu.id
                                ? "..."
                                : "Complete"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                  : `Load More (${total - followUps.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Create Modal ──────────────────────────────────────── */}
      {showModal && (
        <div
          className="ui-modal-overlay"
          onClick={() => {
            setShowModal(false);
            resetForm();
          }}
        >
          <div
            className="ui-modal ui-modal--md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-modal-header">
              <h3>New Follow-up</h3>
              <button
                className="ui-modal-close"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                &times;
              </button>
            </div>
            <div className="ui-modal-body">
              <div className="followups-form">
                {/* Customer (searchable) */}
                <div className="followups-form-group">
                  <label className="followups-form-label">
                    Customer <span className="followups-required">*</span>
                  </label>
                  <div className="followups-customer-search-wrapper">
                    <Search size={16} className="followups-customer-search-icon" />
                    <input
                      type="text"
                      className="followups-form-input"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) =>
                        handleCustomerSearchChange(e.target.value)
                      }
                      onFocus={() => {
                        if (customerOptions.length > 0)
                          setShowCustomerDropdown(true);
                      }}
                    />
                    {showCustomerDropdown && (
                      <div className="followups-customer-dropdown">
                        {customerOptions.map((c) => (
                          <div
                            key={c.id}
                            className="followups-customer-option"
                            onClick={() => selectCustomer(c)}
                          >
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedCustomerName && (
                    <div className="followups-selected-customer">
                      <CheckCircle size={14} />
                      {selectedCustomerName}
                    </div>
                  )}
                </div>

                {/* Contact (filtered by customer) */}
                {formCustomerId && (
                  <div className="followups-form-group">
                    <label className="followups-form-label">Contact</label>
                    {loadingContacts ? (
                      <span className="followups-form-hint">
                        Loading contacts...
                      </span>
                    ) : contactOptions.length === 0 ? (
                      <span className="followups-form-hint">
                        No contacts for this customer
                      </span>
                    ) : (
                      <select
                        className="followups-form-select"
                        value={formContactId}
                        onChange={(e) => setFormContactId(e.target.value)}
                      >
                        <option value="">-- Select contact --</option>
                        {contactOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Title */}
                <div className="followups-form-group">
                  <label className="followups-form-label">
                    Title <span className="followups-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="followups-form-input"
                    placeholder="e.g. Follow up on pump quote"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="followups-form-group">
                  <label className="followups-form-label">Description</label>
                  <textarea
                    className="followups-form-textarea"
                    rows={3}
                    placeholder="Optional notes..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {/* Due Date + Priority row */}
                <div className="followups-form-row">
                  <div className="followups-form-group followups-form-group--half">
                    <label className="followups-form-label">
                      Due Date <span className="followups-required">*</span>
                    </label>
                    <input
                      type="date"
                      className="followups-form-input"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                    />
                  </div>
                  <div className="followups-form-group followups-form-group--half">
                    <label className="followups-form-label">Priority</label>
                    <select
                      className="followups-form-select"
                      value={formPriority}
                      onChange={(e) =>
                        setFormPriority(
                          e.target.value as "HOT" | "NORMAL" | "LOW"
                        )
                      }
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HOT">Hot</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="ui-modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create Follow-up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
