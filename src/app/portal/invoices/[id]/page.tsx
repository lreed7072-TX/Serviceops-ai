"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface InvoiceLineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  title: string;
  description: string | null;
  status: string;
  subtotal: number | string;
  tax: number | string;
  taxRate: number | string;
  total: number | string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  site: { name: string } | null;
  workOrder: { id: string; title: string; workOrderNumber: string | null } | null;
  lineItems: InvoiceLineItem[];
}

export default function PortalInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (invoiceId) {
      fetch(`/api/portal/invoices/${invoiceId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => setInvoice(data.data))
        .catch(() => router.push("/portal/invoices"))
        .finally(() => setLoading(false));
    }
  }, [invoiceId, router]);

  const getStatusClass = (status: string) =>
    status?.toLowerCase().replace("_", "-") || "";

  if (loading) {
    return (
      <div className="portal-loading">
        <div className="portal-spinner" />
        <span>Loading invoice...</span>
      </div>
    );
  }

  if (!invoice) return null;

  const isOverdue = invoice.status === "OVERDUE" ||
    (invoice.status === "SENT" && invoice.dueDate && new Date(invoice.dueDate) < new Date());

  return (
    <div>
      <Link href="/portal/invoices" style={{ color: "var(--text-light)", textDecoration: "none", fontSize: "0.875rem" }}>
        ← Back to Invoices
      </Link>

      <div className="portal-detail-header" style={{ marginTop: "var(--space-md)" }}>
        <div>
          <div className="portal-detail-title">{invoice.title}</div>
          <div className="portal-detail-number">
            {invoice.invoiceNumber}
            <span className={`portal-status ${getStatusClass(invoice.status)}`} style={{ marginLeft: "12px" }}>
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="portal-detail-actions">
          <a
            href={`/api/invoices/${invoiceId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-btn portal-btn-secondary"
          >
            Download PDF
          </a>
        </div>
      </div>

      <div className="portal-detail-meta">
        {invoice.site && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Site</span>
            <span className="portal-detail-meta-value">{invoice.site.name}</span>
          </div>
        )}
        <div className="portal-detail-meta-item">
          <span className="portal-detail-meta-label">Invoice Date</span>
          <span className="portal-detail-meta-value">
            {new Date(invoice.createdAt).toLocaleDateString()}
          </span>
        </div>
        {invoice.dueDate && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Due Date</span>
            <span className="portal-detail-meta-value" style={isOverdue ? { color: "var(--error)" } : {}}>
              {new Date(invoice.dueDate).toLocaleDateString()}
              {isOverdue && " (Overdue)"}
            </span>
          </div>
        )}
        {invoice.paidAt && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Paid</span>
            <span className="portal-detail-meta-value" style={{ color: "var(--success)" }}>
              {new Date(invoice.paidAt).toLocaleDateString()}
            </span>
          </div>
        )}
        {invoice.workOrder && (
          <div className="portal-detail-meta-item">
            <span className="portal-detail-meta-label">Work Order</span>
            <span className="portal-detail-meta-value">
              {invoice.workOrder.workOrderNumber || invoice.workOrder.title}
            </span>
          </div>
        )}
      </div>

      {invoice.description && (
        <div className="portal-card" style={{ marginBottom: "var(--space-md)" }}>
          <div className="portal-card-body">
            <p style={{ color: "var(--text-light)", fontSize: "0.9375rem" }}>{invoice.description}</p>
          </div>
        </div>
      )}

      <div className="portal-card">
        <div className="portal-card-header">
          <h2>Line Items</h2>
        </div>
        <table className="portal-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Type</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.itemType}</td>
                <td className="text-right">{Number(item.quantity)}</td>
                <td className="text-right">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="text-right">${Number(item.totalPrice).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="portal-card-body">
          <div className="portal-totals">
            <div className="portal-total-row">
              <span className="portal-total-label">Subtotal</span>
              <span className="portal-total-value">${Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            {Number(invoice.tax) > 0 && (
              <div className="portal-total-row">
                <span className="portal-total-label">Tax ({Number(invoice.taxRate)}%)</span>
                <span className="portal-total-value">${Number(invoice.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="portal-total-row grand-total">
              <span className="portal-total-label">Total</span>
              <span className="portal-total-value">${Number(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {(invoice.notes || invoice.terms) && (
        <div className="portal-card" style={{ marginTop: "var(--space-md)" }}>
          <div className="portal-card-body">
            {invoice.notes && (
              <div style={{ marginBottom: invoice.terms ? "var(--space-md)" : 0 }}>
                <div className="portal-detail-meta-label" style={{ marginBottom: "4px" }}>Notes</div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-light)", whiteSpace: "pre-wrap" }}>{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <div className="portal-detail-meta-label" style={{ marginBottom: "4px" }}>Payment Terms</div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-light)", whiteSpace: "pre-wrap" }}>{invoice.terms}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
