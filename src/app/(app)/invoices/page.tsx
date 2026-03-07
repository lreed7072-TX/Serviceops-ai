"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  FileText,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
  Plus,
  Download,
  Eye,
} from "lucide-react";
import "./invoices.css";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  title: string;
  total: string | number;
  dueDate: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  workOrder: { id: string; title: string; workOrderNumber: string | null } | null;
  _count: { lineItems: number };
};

type StatusTab = "ALL" | "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";

const STATUS_TABS: StatusTab[] = ["ALL", "DRAFT", "SENT", "PAID", "OVERDUE", "VOID"];
const PAGE_SIZE = 50;

export default function InvoicesPage() {
  const router = useRouter();
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusTab>("ALL");
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const loadInvoices = useCallback(
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

        const res = await apiFetch(`/api/invoices?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load invoices");

        const data = await res.json();
        const items = data.data ?? [];

        if (append) {
          setInvoices((prev) => [...prev, ...items]);
        } else {
          setInvoices(items);
        }
        setTotal(data.total ?? items.length);
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? "Failed to load invoices";
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
    loadInvoices(0, false);
  }, [loadInvoices]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleLoadMore = () => {
    loadInvoices(invoices.length, true);
  };

  const hasMore = invoices.length < total;

  // Stats from current loaded set
  const stats = useMemo(() => {
    const totalValue = invoices.reduce(
      (sum, inv) => sum + parseFloat(inv.total.toString()),
      0
    );
    const paidCount = invoices.filter((inv) => inv.status === "PAID").length;
    const overdueCount = invoices.filter((inv) => inv.status === "OVERDUE").length;

    return { totalCount: total, totalValue, paidCount, overdueCount };
  }, [invoices, total]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "\u2014";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case "DRAFT":
        return "draft";
      case "SENT":
        return "sent";
      case "PAID":
        return "paid";
      case "OVERDUE":
        return "overdue";
      case "VOID":
      case "CANCELED":
        return "void";
      default:
        return "draft";
    }
  };

  return (
    <div className="invoices-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Invoices</h1>
          <p className="page-subtitle">
            Manage billing, track payments, and monitor outstanding balances
          </p>
        </div>
        <div className="page-header-right">
          <div className="invoices-header-actions">
            <button
              className="invoices-create-btn"
              onClick={() => router.push("/invoices/new")}
            >
              <Plus size={18} />
              Create Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="invoices-error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="invoices-stats-grid">
        <div className="invoices-stat-card total">
          <div className="invoices-stat-icon total">
            <FileText size={22} />
          </div>
          <div className="invoices-stat-info">
            <span className="invoices-stat-value">{stats.totalCount}</span>
            <span className="invoices-stat-label">Total Invoices</span>
          </div>
        </div>

        <div className="invoices-stat-card value">
          <div className="invoices-stat-icon value">
            <DollarSign size={22} />
          </div>
          <div className="invoices-stat-info">
            <span className="invoices-stat-value">
              {formatCurrency(stats.totalValue)}
            </span>
            <span className="invoices-stat-label">Total Value</span>
          </div>
        </div>

        <div className="invoices-stat-card paid">
          <div className="invoices-stat-icon paid">
            <CheckCircle size={22} />
          </div>
          <div className="invoices-stat-info">
            <span className="invoices-stat-value">{stats.paidCount}</span>
            <span className="invoices-stat-label">Paid</span>
          </div>
        </div>

        <div className="invoices-stat-card overdue">
          <div className="invoices-stat-icon overdue">
            <AlertCircle size={22} />
          </div>
          <div className="invoices-stat-info">
            <span className="invoices-stat-value">{stats.overdueCount}</span>
            <span className="invoices-stat-label">Overdue</span>
          </div>
        </div>
      </div>

      {/* Search + Filter Toolbar */}
      <div className="invoices-toolbar">
        <div className="invoices-search-row">
          <div className="invoices-search-wrapper">
            <span className="invoices-search-icon">
              <Search size={18} />
            </span>
            <input
              type="text"
              className="invoices-search-input"
              placeholder="Search by invoice number or customer name..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="invoices-filter-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                className={`invoices-filter-tab ${statusFilter === tab ? "active" : ""}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="invoices-results-count">
          Showing <strong>{invoices.length}</strong> of{" "}
          <strong>{total}</strong> invoices
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="invoices-loading">
          <div className="invoices-loading-spinner" />
          <span className="invoices-loading-text">Loading invoices...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && invoices.length === 0 && (
        <div className="invoices-empty">
          <div className="invoices-empty-icon">
            <FileText size={48} />
          </div>
          <h3>
            {searchTerm || statusFilter !== "ALL"
              ? "No invoices match your filters"
              : "No invoices yet"}
          </h3>
          <p>
            {searchTerm || statusFilter !== "ALL"
              ? "Try adjusting your search term or status filter to find what you're looking for."
              : "Generate invoices from completed work orders to automatically calculate labor and material costs."}
          </p>
          {!searchTerm && statusFilter === "ALL" && (
            <button
              className="invoices-empty-btn"
              onClick={() => router.push("/invoices/new")}
            >
              <Plus size={18} />
              Create Invoice
            </button>
          )}
        </div>
      )}

      {/* Data Table */}
      {!loading && invoices.length > 0 && (
        <>
        <div className="invoices-table-card">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Due Date</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <td>
                    <span className="invoices-invoice-number">
                      {invoice.invoiceNumber}
                    </span>
                  </td>
                  <td>
                    <span className="invoices-customer-name">
                      {invoice.customer.name}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="invoices-amount">
                      {formatCurrency(parseFloat(invoice.total.toString()))}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`invoices-badge ${getStatusClass(invoice.status)}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td>
                    <span className="invoices-date">
                      {formatDate(invoice.createdAt)}
                    </span>
                  </td>
                  <td>
                    <span className="invoices-date-muted">
                      {formatDate(invoice.dueDate)}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="invoices-actions">
                      <button
                        className="invoices-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/invoices/${invoice.id}`);
                        }}
                      >
                        <Eye size={14} />
                        View
                      </button>
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
              {loadingMore ? "Loading..." : `Load More (${total - invoices.length} remaining)`}
            </button>
          </div>
        )}
      </>
      )}
    </div>
  );
}
