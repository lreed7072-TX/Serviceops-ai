"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  title: string;
  total: number;
  dueDate: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  workOrder: { id: string; title: string; workOrderNumber: string | null } | null;
  _count: { lineItems: number };
};

const statusColors: Record<string, string> = {
  DRAFT: "#6b7280",
  SENT: "#3b82f6",
  PAID: "#10b981",
  OVERDUE: "#ef4444",
  CANCELED: "#9ca3af",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter) params.append("status", statusFilter);
        
        const res = await apiFetch(`/api/invoices?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load invoices");
        
        const data = await res.json();
        setInvoices(data.data ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load invoices");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [statusFilter]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Invoices</h1>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600 }}>Filter by status:</span>
          <button 
            onClick={() => setStatusFilter("")}
            className={`btn ${statusFilter === "" ? "btn-primary" : "btn-outline"}`}
            style={{ padding: "6px 12px", fontSize: 14 }}
          >
            All
          </button>
          {["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELED"].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`btn ${statusFilter === status ? "btn-primary" : "btn-outline"}`}
              style={{ padding: "6px 12px", fontSize: 14 }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <div className="alert alert-info">Loading invoices...</div>}

      {!loading && invoices.length === 0 && (
        <div className="card">
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
            No invoices found. Generate invoices from completed work orders.
          </p>
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Invoice #</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Customer</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Work Order</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: "right", padding: "12px 8px", fontWeight: 600 }}>Total</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Due Date</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr 
                  key={invoice.id}
                  style={{ 
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                  onClick={() => window.location.href = `/invoices/${invoice.id}`}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "12px 8px" }}>
                    <Link 
                      href={`/invoices/${invoice.id}`}
                      style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 8px" }}>{invoice.customer.name}</td>
                  <td style={{ padding: "12px 8px" }}>
                    {invoice.workOrder ? (
                      <Link
                        href={`/work-orders/${invoice.workOrder.id}`}
                        style={{ color: "var(--primary)", textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {invoice.workOrder.workOrderNumber || invoice.workOrder.title}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <span 
                      style={{ 
                        background: statusColors[invoice.status] || "#6b7280",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600
                      }}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>
                    ${parseFloat(invoice.total.toString()).toFixed(2)}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 14 }}>
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--bg-muted)", borderRadius: 8, fontSize: 14, color: "var(--text-muted)" }}>
        <strong>💡 Tip:</strong> Generate invoices from completed work orders to automatically calculate labor and material costs.
      </div>
    </div>
  );
}
