"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";

type Customer = { id: string; name: string };
type Invoice = {
  id: string;
  invoiceNumber: string;
  title: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  dueDate: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  site: { id: string; name: string } | null;
  workOrder: { id: string; workOrderNumber: string } | null;
  _count: { lineItems: number };
};

const statusColors: Record<string, string> = {
  DRAFT: "gray",
  ISSUED: "blue",
  PAID: "green",
  OVERDUE: "red",
  VOID: "orange",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (customerFilter) params.append("customerId", customerFilter);

      const [iRes, cRes] = await Promise.all([
        apiFetch(`/api/invoices?${params.toString()}`, { cache: "no-store" }),
        apiFetch("/api/customers", { cache: "no-store" }),
      ]);
      
      if (iRes.ok) setInvoices((await iRes.json()).data ?? []);
      if (cRes.ok) setCustomers((await cRes.json()).data ?? []);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [statusFilter, customerFilter]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  // Calculate totals
  const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const paidAmount = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const overdueAmount = invoices
    .filter((inv) => inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + Number(inv.total), 0);

  return (
    <div>
      <PageHeader title="Invoices" subtitle="Manage customer invoices and payments" />

      {error && <div className="page-alert error">{error}</div>}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Total Outstanding</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "var(--primary)" }}>{formatCurrency(totalAmount - paidAmount)}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Total Paid</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "var(--success)" }}>{formatCurrency(paidAmount)}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Overdue</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "var(--danger)" }}>{formatCurrency(overdueAmount)}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>Total Invoices</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{invoices.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Invoices</h3>
          <Link href="/invoices/new" className="btn btn-primary">
            + New Invoice
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: "0 20px" }}>
          <label className="form-field" style={{ flex: 1 }}>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ISSUED">Issued</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="VOID">Void</option>
            </select>
          </label>
          <label className="form-field" style={{ flex: 1 }}>
            <span>Customer</span>
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p style={{ padding: 20 }}>Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 40 }}>
            {statusFilter || customerFilter ? "No invoices match the selected filters." : "No invoices yet. Create your first invoice to get started."}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Title</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Items</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Due Date</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.invoiceNumber}</strong>
                  </td>
                  <td>{inv.title}</td>
                  <td>{inv.customer.name}</td>
                  <td>
                    <span className={`status-badge ${statusColors[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td>{inv._count.lineItems} items</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>
                    {formatCurrency(Number(inv.total))}
                  </td>
                  <td>
                    {inv.dueDate ? (
                      <span
                        style={{
                          color:
                            inv.status === "OVERDUE"
                              ? "var(--danger)"
                              : "inherit",
                        }}
                      >
                        {formatDate(inv.dueDate)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="link-button">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
