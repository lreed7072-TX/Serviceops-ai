"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type InvoiceLineItem = {
  id: string;
  itemType: string;
  description: string;
  quantity: string | number; // Prisma Decimal serializes to string
  unitPrice: string | number;
  totalPrice: string | number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  title: string;
  description: string | null;
  subtotal: string | number; // Prisma Decimal serializes to string
  tax: string | number;
  taxRate: string | number;
  total: string | number;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  customer: { id: string; name: string; primaryEmail: string | null };
  site: { id: string; name: string } | null;
  workOrder: { id: string; title: string; workOrderNumber: string | null } | null;
  lineItems: InvoiceLineItem[];
};

const statusOptions = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELED"];
const statusColors: Record<string, string> = {
  DRAFT: "#6b7280",
  SENT: "#3b82f6",
  PAID: "#10b981",
  OVERDUE: "#ef4444",
  CANCELED: "#9ca3af",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params?.id as string | undefined;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/invoices/${invoiceId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load invoice");
        
        const data = await res.json();
        setInvoice(data.data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [invoiceId]);

  const updateStatus = async (newStatus: string) => {
    if (!invoiceId) return;
    
    setUpdating(true);
    try {
      const res = await apiFetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!res.ok) throw new Error("Failed to update status");
      
      const data = await res.json();
      setInvoice(data.data);
    } catch (e: any) {
      alert(e?.message ?? "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  if (!invoiceId) return <div className="card"><p>Missing invoice ID.</p></div>;
  if (loading) return <div className="page-container"><div className="alert alert-info">Loading invoice...</div></div>;
  if (error) return <div className="page-container"><div className="alert alert-error">{error}</div></div>;
  if (!invoice) return <div className="page-container"><div className="alert alert-error">Invoice not found</div></div>;

  const laborItems = invoice.lineItems.filter(item => item.itemType === "LABOR");
  const materialItems = invoice.lineItems.filter(item => item.itemType === "MATERIAL");

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link href="/invoices" className="back-link">← Invoices</Link>
          <h1>{invoice.invoiceNumber}</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span 
            style={{ 
              background: statusColors[invoice.status] || "#6b7280",
              color: "white",
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600
            }}
          >
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Invoice Header */}
      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
          <div>
            <h3 style={{ marginBottom: 12 }}>Customer</h3>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>{invoice.customer.name}</p>
            {invoice.customer.primaryEmail && (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{invoice.customer.primaryEmail}</p>
            )}
            {invoice.site && (
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
                📍 {invoice.site.name}
              </p>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>Invoice Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><span style={{ color: "var(--text-muted)" }}>Title:</span> <strong>{invoice.title}</strong></div>
              {invoice.description && (
                <div><span style={{ color: "var(--text-muted)" }}>Description:</span> {invoice.description}</div>
              )}
              {invoice.workOrder && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Work Order:</span>{" "}
                  <Link href={`/work-orders/${invoice.workOrder.id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
                    {invoice.workOrder.workOrderNumber || invoice.workOrder.title}
                  </Link>
                </div>
              )}
              <div>
                <span style={{ color: "var(--text-muted)" }}>Created:</span> {new Date(invoice.createdAt).toLocaleDateString()}
              </div>
              {invoice.dueDate && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Due Date:</span> {new Date(invoice.dueDate).toLocaleDateString()}
                </div>
              )}
              {invoice.paidAt && (
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Paid:</span> {new Date(invoice.paidAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Management */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Update Status</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {statusOptions.map(status => (
            <button
              key={status}
              onClick={() => updateStatus(status)}
              disabled={updating || invoice.status === status}
              className={invoice.status === status ? "btn-primary" : "btn btn-outline"}
              style={{ fontSize: 14, padding: "8px 16px" }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Labor Line Items */}
      {laborItems.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Labor</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600 }}>Description</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Hours</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Rate</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {laborItems.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 8px" }}>{item.description}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>{parseFloat(item.quantity.toString()).toFixed(2)}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>${parseFloat(item.unitPrice.toString()).toFixed(2)}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>
                    ${parseFloat(item.totalPrice.toString()).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Material Line Items */}
      {materialItems.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Materials</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "8px", fontWeight: 600 }}>Description</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Qty</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Unit Price</th>
                <th style={{ textAlign: "right", padding: "8px", fontWeight: 600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {materialItems.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 8px" }}>{item.description}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>{parseFloat(item.quantity.toString()).toFixed(2)}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>${parseFloat(item.unitPrice.toString()).toFixed(2)}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>
                    ${parseFloat(item.totalPrice.toString()).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="card" style={{ background: "var(--bg-muted)" }}>
        <div style={{ maxWidth: 400, marginLeft: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <span>Subtotal:</span>
            <span style={{ fontWeight: 600 }}>${parseFloat(invoice.subtotal.toString()).toFixed(2)}</span>
          </div>
          {Number(invoice.tax) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span>Tax ({parseFloat(invoice.taxRate.toString()).toFixed(2)}%):</span>
              <span style={{ fontWeight: 600 }}>${parseFloat(invoice.tax.toString()).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 18 }}>
            <span style={{ fontWeight: 700 }}>Total:</span>
            <span style={{ fontWeight: 700, color: "var(--primary)" }}>${parseFloat(invoice.total.toString()).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms & Notes */}
      {(invoice.terms || invoice.notes) && (
        <div className="card">
          {invoice.terms && (
            <div style={{ marginBottom: invoice.notes ? 16 : 0 }}>
              <h4 style={{ marginBottom: 8 }}>Payment Terms</h4>
              <p style={{ color: "var(--text-muted)" }}>{invoice.terms}</p>
            </div>
          )}
          {invoice.notes && (
            <div>
              <h4 style={{ marginBottom: 8 }}>Notes</h4>
              <p style={{ color: "var(--text-muted)" }}>{invoice.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
