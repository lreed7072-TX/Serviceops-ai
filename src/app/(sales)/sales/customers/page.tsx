"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  Users,
  Star,
  Search,
  AlertCircle,
  Award,
  TrendingUp,
  Minus,
} from "lucide-react";
import "./customers.css";

type Customer = {
  id: string;
  name: string;
  status: string;
  primaryPhone: string | null;
  tier: "A" | "B" | "C" | null;
  leadSourceId: string | null;
  assignedToUserId: string | null;
  assignedTo?: { id: string; name: string } | null;
  leadSource?: { id: string; name: string } | null;
  _count?: {
    contacts: number;
    sites: number;
    workOrders: number;
  };
};

type LeadSource = {
  id: string;
  name: string;
};

const PAGE_SIZE = 50;

export default function SalesCustomersPage() {
  const router = useRouter();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounce search input
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };

  // Load lead sources once
  useEffect(() => {
    apiFetch("/api/crm/lead-sources")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setLeadSources(json.data ?? []))
      .catch(() => {});
  }, []);

  const loadCustomers = useCallback(
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
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await apiFetch(`/api/customers?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load customers");

        const data = await res.json();
        const items = data.data ?? [];

        if (append) {
          setCustomers((prev) => [...prev, ...items]);
        } else {
          setCustomers(items);
        }
        setTotal(data.total ?? items.length);
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? "Failed to load customers";
        setError(msg);
        if (!append) toast.error(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, toast]
  );

  useEffect(() => {
    loadCustomers(0, false);
  }, [loadCustomers]);

  const handleLoadMore = () => {
    loadCustomers(customers.length, true);
  };

  const hasMore = customers.length < total;

  // Stats
  const stats = useMemo(() => {
    const tierA = customers.filter((c) => c.tier === "A").length;
    const tierB = customers.filter((c) => c.tier === "B").length;
    const tierC = customers.filter((c) => c.tier === "C").length;
    return { totalCount: total, tierA, tierB, tierC };
  }, [customers, total]);

  const getLeadSourceName = (id: string | null): string => {
    if (!id) return "\u2014";
    const ls = leadSources.find((s) => s.id === id);
    return ls?.name ?? "\u2014";
  };

  const getAssignedRepName = (customer: Customer): string => {
    return customer.assignedTo?.name ?? "\u2014";
  };

  return (
    <div className="sales-customers-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customers</h1>
          <p className="page-subtitle">
            CRM customer accounts with tier classification and contact management
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="sc-error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="sc-stats-grid">
        <div className="sc-stat-card total">
          <div className="sc-stat-icon total">
            <Users size={22} />
          </div>
          <div className="sc-stat-info">
            <span className="sc-stat-value">{stats.totalCount}</span>
            <span className="sc-stat-label">Total Customers</span>
          </div>
        </div>

        <div className="sc-stat-card tier-a">
          <div className="sc-stat-icon tier-a">
            <Star size={22} />
          </div>
          <div className="sc-stat-info">
            <span className="sc-stat-value">{stats.tierA}</span>
            <span className="sc-stat-label">Tier A</span>
          </div>
        </div>

        <div className="sc-stat-card tier-b">
          <div className="sc-stat-icon tier-b">
            <TrendingUp size={22} />
          </div>
          <div className="sc-stat-info">
            <span className="sc-stat-value">{stats.tierB}</span>
            <span className="sc-stat-label">Tier B</span>
          </div>
        </div>

        <div className="sc-stat-card tier-c">
          <div className="sc-stat-icon tier-c">
            <Minus size={22} />
          </div>
          <div className="sc-stat-info">
            <span className="sc-stat-value">{stats.tierC}</span>
            <span className="sc-stat-label">Tier C</span>
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="sc-toolbar">
        <div className="sc-search-row">
          <div className="sc-search-wrapper">
            <span className="sc-search-icon">
              <Search size={18} />
            </span>
            <input
              type="text"
              className="sc-search-input"
              placeholder="Search customers by name..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="sc-results-count">
          Showing <strong>{customers.length}</strong> of{" "}
          <strong>{total}</strong> customers
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="sc-loading">
          <div className="sc-loading-spinner" />
          <span className="sc-loading-text">Loading customers...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && customers.length === 0 && (
        <div className="sc-empty">
          <div className="sc-empty-icon">
            <Users size={48} />
          </div>
          <h3>
            {debouncedSearch
              ? "No customers match your search"
              : "No customers yet"}
          </h3>
          <p>
            {debouncedSearch
              ? "Try adjusting your search term to find what you're looking for."
              : "Customers will appear here once they have been added to the system."}
          </p>
        </div>
      )}

      {/* Data Table */}
      {!loading && customers.length > 0 && (
        <>
          <div className="sc-table-card">
            <table className="sc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Tier</th>
                  <th>Lead Source</th>
                  <th>Assigned Rep</th>
                  <th>Phone</th>
                  <th className="text-center"># Contacts</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => router.push(`/sales/customers/${customer.id}`)}
                  >
                    <td>
                      <span className="sc-customer-name">{customer.name}</span>
                    </td>
                    <td>
                      <span
                        className={`sc-tier-badge ${
                          customer.tier
                            ? `tier-${customer.tier.toLowerCase()}`
                            : "tier-none"
                        }`}
                      >
                        {customer.tier ?? "None"}
                      </span>
                    </td>
                    <td>
                      <span className="sc-lead-source">
                        {customer.leadSource?.name ?? getLeadSourceName(customer.leadSourceId)}
                      </span>
                    </td>
                    <td>
                      <span className="sc-rep-name">
                        {getAssignedRepName(customer)}
                      </span>
                    </td>
                    <td>
                      <span className="sc-phone">
                        {customer.primaryPhone || "\u2014"}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="sc-contact-count">
                        {customer._count?.contacts ?? 0}
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
                  : `Load More (${total - customers.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
