"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Target,
  Search,
  Plus,
  AlertCircle,
  DollarSign,
  Calendar,
  X,
  User,
} from "lucide-react";
import "./opportunities.css";

/* ─── Types ──────────────────────────────────────────────────────── */

type Opportunity = {
  id: string;
  name: string;
  status: string;
  amount: string | number | null;
  expectedCloseDate: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  contact: { id: string; firstName: string; lastName: string } | null;
  createdBy: { id: string; name: string };
};

type Customer = {
  id: string;
  name: string;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
};

type StageTab =
  | "ALL"
  | "PROSPECTING"
  | "QUALIFICATION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

const STAGE_TABS: StageTab[] = [
  "ALL",
  "PROSPECTING",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];

const STAGE_LABELS: Record<string, string> = {
  ALL: "All",
  PROSPECTING: "Prospecting",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

const PAGE_SIZE = 50;

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

export default function OpportunitiesPage() {
  const router = useRouter();
  const toast = useToast();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<StageTab>("ALL");

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    contactId: "",
    name: "",
    description: "",
    amount: "",
    expectedCloseDate: "",
  });

  const customerSearchRef = useRef<HTMLDivElement>(null);

  /* ─── Load opportunities ──────────────────────────────────────── */

  const loadOpportunities = useCallback(
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
        if (stageFilter !== "ALL") params.set("status", stageFilter);
        if (searchTerm) params.set("search", searchTerm);

        const res = await apiFetch(`/api/opportunities?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load opportunities");

        const data = await res.json();
        const items = data.data ?? [];

        if (append) {
          setOpportunities((prev) => [...prev, ...items]);
        } else {
          setOpportunities(items);
        }
        setTotal(data.total ?? items.length);
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? "Failed to load opportunities";
        setError(msg);
        if (!append) toast.error(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [stageFilter, searchTerm, toast]
  );

  useEffect(() => {
    loadOpportunities(0, false);
  }, [loadOpportunities]);

  const handleLoadMore = () => {
    loadOpportunities(opportunities.length, true);
  };

  const hasMore = opportunities.length < total;

  /* ─── Customer search for create modal ────────────────────────── */

  const loadCustomers = async () => {
    try {
      const res = await apiFetch("/api/customers?limit=200", {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setCustomers(json.data ?? []);
      }
    } catch {
      // silent
    }
  };

  const loadContacts = async (customerId: string) => {
    try {
      const res = await apiFetch(
        `/api/contacts?customerId=${customerId}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json();
        setContacts(json.data ?? []);
      }
    } catch {
      setContacts([]);
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const selectCustomer = (customer: Customer) => {
    setFormData((prev) => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      contactId: "",
    }));
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    loadContacts(customer.id);
  };

  const clearCustomer = () => {
    setFormData((prev) => ({
      ...prev,
      customerId: "",
      customerName: "",
      contactId: "",
    }));
    setContacts([]);
  };

  /* ─── Open create modal ───────────────────────────────────────── */

  const openCreateModal = () => {
    setFormData({
      customerId: "",
      customerName: "",
      contactId: "",
      name: "",
      description: "",
      amount: "",
      expectedCloseDate: "",
    });
    setContacts([]);
    setCustomerSearch("");
    setShowCreateModal(true);
    loadCustomers();
  };

  /* ─── Submit create ───────────────────────────────────────────── */

  const handleCreate = async () => {
    if (!formData.customerId || !formData.name) {
      toast.warning("Customer and Name are required");
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, any> = {
        customerId: formData.customerId,
        name: formData.name,
      };
      if (formData.contactId) body.contactId = formData.contactId;
      if (formData.description) body.description = formData.description;
      if (formData.amount) body.amount = parseFloat(formData.amount);
      if (formData.expectedCloseDate)
        body.expectedCloseDate = formData.expectedCloseDate;

      const res = await apiFetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to create opportunity");
      }

      toast.success("Opportunity created");
      setShowCreateModal(false);
      loadOpportunities(0, false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create opportunity");
    } finally {
      setCreating(false);
    }
  };

  /* ─── Close dropdown on outside click ─────────────────────────── */

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <div className="opportunities-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Opportunities</h1>
          <p className="page-subtitle">
            Track your sales pipeline from prospecting to close
          </p>
        </div>
        <div className="page-header-right">
          <div className="opps-header-actions">
            <button className="opps-create-btn" onClick={openCreateModal}>
              <Plus size={18} />
              New Opportunity
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="opps-error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Search + Stage Filter Toolbar */}
      <div className="opps-toolbar">
        <div className="opps-search-row">
          <div className="opps-search-wrapper">
            <span className="opps-search-icon">
              <Search size={18} />
            </span>
            <input
              type="text"
              className="opps-search-input"
              placeholder="Search by name or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="opps-filter-tabs">
            {STAGE_TABS.map((tab) => (
              <button
                key={tab}
                className={`opps-filter-tab ${stageFilter === tab ? "active" : ""}`}
                onClick={() => setStageFilter(tab)}
              >
                {STAGE_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>
        <div className="opps-results-count">
          Showing <strong>{opportunities.length}</strong> of{" "}
          <strong>{total}</strong> opportunities
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="opps-loading">
          <div className="opps-loading-spinner" />
          <span className="opps-loading-text">Loading opportunities...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && opportunities.length === 0 && (
        <div className="opps-empty">
          <div className="opps-empty-icon">
            <Target size={48} />
          </div>
          <h3>
            {searchTerm || stageFilter !== "ALL"
              ? "No opportunities match your filters"
              : "No opportunities yet"}
          </h3>
          <p>
            {searchTerm || stageFilter !== "ALL"
              ? "Try adjusting your search term or stage filter to find what you're looking for."
              : "Create your first opportunity to start tracking your sales pipeline."}
          </p>
          {!searchTerm && stageFilter === "ALL" && (
            <button className="opps-empty-btn" onClick={openCreateModal}>
              <Plus size={18} />
              New Opportunity
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      {!loading && opportunities.length > 0 && (
        <>
          <div className="opps-table-card">
            <table className="opps-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Customer</th>
                  <th className="text-right">Amount</th>
                  <th>Expected Close</th>
                  <th>Stage</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr
                    key={opp.id}
                    onClick={() =>
                      router.push(`/sales/opportunities/${opp.id}`)
                    }
                  >
                    <td>
                      <span className="opps-name">{opp.name}</span>
                    </td>
                    <td>
                      <span className="opps-customer">
                        {opp.customer?.name || "\u2014"}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="opps-amount">
                        {opp.amount != null
                          ? formatCurrency(parseFloat(opp.amount.toString()))
                          : "\u2014"}
                      </span>
                    </td>
                    <td>
                      <span className="opps-date">
                        {formatDate(opp.expectedCloseDate)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`opps-stage-badge ${getStageClass(opp.status)}`}
                      >
                        {STAGE_LABELS[opp.status] || opp.status}
                      </span>
                    </td>
                    <td>
                      <span className="opps-created-by">
                        {opp.createdBy?.name || "\u2014"}
                      </span>
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
                  : `Load More (${total - opportunities.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Create Opportunity Modal ───────────────────────────── */}
      {showCreateModal && (
        <div
          className="opps-modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="opps-modal wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="opps-modal-header">
              <h3 className="opps-modal-title">New Opportunity</h3>
              <button
                className="opps-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="opps-modal-body">
              <div className="opps-form-grid">
                {/* Customer (searchable) */}
                <div className="opps-form-field full-width">
                  <label className="opps-form-label">
                    Customer <span className="required">*</span>
                  </label>
                  {formData.customerId ? (
                    <div className="opps-selected-customer">
                      <span>
                        <User size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                        {formData.customerName}
                      </span>
                      <button onClick={clearCustomer} title="Remove customer">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="opps-customer-search-wrapper"
                      ref={customerSearchRef}
                    >
                      <input
                        type="text"
                        className="opps-form-input"
                        placeholder="Search customers..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                      />
                      {showCustomerDropdown && filteredCustomers.length > 0 && (
                        <div className="opps-customer-dropdown">
                          {filteredCustomers.slice(0, 20).map((c) => (
                            <button
                              key={c.id}
                              className="opps-customer-option"
                              onClick={() => selectCustomer(c)}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Contact (filtered by customer) */}
                <div className="opps-form-field">
                  <label className="opps-form-label">Contact</label>
                  <select
                    className="opps-form-select"
                    value={formData.contactId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        contactId: e.target.value,
                      }))
                    }
                    disabled={!formData.customerId || contacts.length === 0}
                  >
                    <option value="">
                      {!formData.customerId
                        ? "Select customer first"
                        : contacts.length === 0
                          ? "No contacts"
                          : "Select contact..."}
                    </option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="opps-form-field">
                  <label className="opps-form-label">
                    Opportunity Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="opps-form-input"
                    placeholder="e.g., Annual Pump Maintenance Contract"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                {/* Description */}
                <div className="opps-form-field full-width">
                  <label className="opps-form-label">Description</label>
                  <textarea
                    className="opps-form-textarea"
                    rows={3}
                    placeholder="Additional details about this opportunity..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
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
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setFormData((prev) => ({ ...prev, amount: value }));
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
                    value={formData.expectedCloseDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        expectedCloseDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="opps-modal-footer">
              <button
                className="opps-btn-cancel"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="opps-btn-submit"
                onClick={handleCreate}
                disabled={creating || !formData.customerId || !formData.name}
              >
                {creating ? "Creating..." : "Create Opportunity"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
