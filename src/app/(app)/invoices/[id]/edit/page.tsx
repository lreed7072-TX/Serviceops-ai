"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { InvoiceStatus, InvoiceLineItemType } from "@prisma/client";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import "./edit-invoice.css";

interface InvoiceLineItem {
  id: string;
  itemType: InvoiceLineItemType;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  totalPrice: string | number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  title: string;
  description: string | null;
  subtotal: string | number;
  tax: string | number;
  taxRate: string | number;
  total: string | number;
  dueDate: string | null;
  notes: string | null;
  terms: string | null;
  customer: {
    id: string;
    name: string;
  };
  site: {
    id: string;
    name: string;
  } | null;
  workOrder: {
    id: string;
    title: string;
    workOrderNumber: string | null;
  } | null;
  lineItems: InvoiceLineItem[];
}

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [addingLineItem, setAddingLineItem] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    taxRate: "0",
    dueDate: "",
    notes: "",
    terms: "",
  });

  const [newLineItem, setNewLineItem] = useState({
    itemType: InvoiceLineItemType.LABOR as InvoiceLineItemType,
    description: "",
    quantity: "1",
    unitPrice: "0",
  });

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  const fetchInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/api/invoices/${invoiceId}`);
      if (response.ok) {
        const result = await response.json();
        const inv = result.data as Invoice;
        setInvoice(inv);

        setFormData({
          title: inv.title,
          description: inv.description || "",
          taxRate: String(inv.taxRate),
          dueDate: inv.dueDate ? inv.dueDate.split("T")[0] : "",
          notes: inv.notes || "",
          terms: inv.terms || "",
        });
      } else {
        console.error("Failed to fetch invoice");
        router.push("/invoices");
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      router.push("/invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!invoice) return;

    setSaving(true);
    try {
      const response = await apiFetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          taxRate: parseFloat(formData.taxRate) || 0,
          dueDate: formData.dueDate || null,
          notes: formData.notes || null,
          terms: formData.terms || null,
        }),
      });

      if (response.ok) {
        router.push(`/invoices/${invoiceId}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update invoice");
      }
    } catch (error) {
      console.error("Failed to update invoice:", error);
      alert("Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLineItem = async () => {
    if (!invoice || !newLineItem.description) return;

    setAddingLineItem(true);
    try {
      const response = await apiFetch(`/api/invoices/${invoiceId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: newLineItem.itemType,
          description: newLineItem.description,
          quantity: parseFloat(newLineItem.quantity) || 0,
          unitPrice: parseFloat(newLineItem.unitPrice) || 0,
        }),
      });

      if (response.ok) {
        setShowLineItemModal(false);
        setNewLineItem({
          itemType: InvoiceLineItemType.LABOR,
          description: "",
          quantity: "1",
          unitPrice: "0",
        });
        await fetchInvoice();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add line item");
      }
    } catch (error) {
      console.error("Failed to add line item:", error);
      alert("Failed to add line item");
    } finally {
      setAddingLineItem(false);
    }
  };

  const calculateLineItemTotal = () => {
    const qty = parseFloat(newLineItem.quantity) || 0;
    const price = parseFloat(newLineItem.unitPrice) || 0;
    return (qty * price).toFixed(2);
  };

  if (loading) {
    return (
      <div className="edit-invoice-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading invoice...</span>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="edit-invoice-page">
        <div className="error-container">
          <p>Invoice not found</p>
          <button onClick={() => router.push("/invoices")} className="btn-primary">
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  const isDraft = invoice.status === InvoiceStatus.DRAFT;

  return (
    <div className="edit-invoice-page">
      {/* Header */}
      <div className="page-header">
        <Link href={`/invoices/${invoiceId}`} className="back-link">
          ← Back to Invoice
        </Link>
        <h1>Edit Invoice {invoice.invoiceNumber}</h1>
        <p className="page-subtitle">
          {isDraft ? "Edit invoice details and add line items" : "Edit invoice notes and due date"}
        </p>
      </div>

      {/* Status Banner */}
      {!isDraft && (
        <div className="status-banner">
          <span className="status-icon">ℹ️</span>
          <span>This invoice is <strong>{invoice.status}</strong>. Only due date, notes, and terms can be edited.</span>
        </div>
      )}

      <div className="form-container">
        {/* Customer Info (Read-only) */}
        <div className="form-section">
          <h2 className="section-title">Customer Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Customer</span>
              <span className="info-value">{invoice.customer.name}</span>
            </div>
            {invoice.site && (
              <div className="info-item">
                <span className="info-label">Site</span>
                <span className="info-value">{invoice.site.name}</span>
              </div>
            )}
            {invoice.workOrder && (
              <div className="info-item">
                <span className="info-label">Work Order</span>
                <span className="info-value">
                  {invoice.workOrder.workOrderNumber || invoice.workOrder.title}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="form-section">
          <h2 className="section-title">Invoice Details</h2>
          <div className="form-grid">
            <div className="form-field full-width">
              <label className="field-label">Title {isDraft && "*"}</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="field-input"
                disabled={!isDraft}
                placeholder="Invoice title"
              />
            </div>

            <div className="form-field full-width">
              <label className="field-label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="field-textarea"
                rows={3}
                disabled={!isDraft}
                placeholder="Additional details..."
              />
            </div>

            <div className="form-field">
              <label className="field-label">Tax Rate (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.taxRate}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setFormData({ ...formData, taxRate: value });
                  }
                }}
                className="field-input"
                disabled={!isDraft}
                placeholder="0"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="field-input"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="form-section">
          <div className="section-header">
            <h2 className="section-title">Line Items</h2>
            {isDraft && (
              <button
                type="button"
                onClick={() => setShowLineItemModal(true)}
                className="btn-secondary"
              >
                + Add Item
              </button>
            )}
          </div>

          {invoice.lineItems.length === 0 ? (
            <div className="empty-state">
              <p>No line items yet</p>
              {isDraft && (
                <button onClick={() => setShowLineItemModal(true)} className="btn-text">
                  Add your first line item
                </button>
              )}
            </div>
          ) : (
            <div className="line-items-table">
              <div className="table-header">
                <span className="col-type">Type</span>
                <span className="col-desc">Description</span>
                <span className="col-qty">Qty</span>
                <span className="col-price">Unit Price</span>
                <span className="col-total">Total</span>
              </div>
              {invoice.lineItems.map((item) => (
                <div key={item.id} className="table-row">
                  <span className="col-type">
                    <span className={`type-badge ${item.itemType.toLowerCase()}`}>
                      {item.itemType}
                    </span>
                  </span>
                  <span className="col-desc">{item.description}</span>
                  <span className="col-qty">{Number(item.quantity).toFixed(2)}</span>
                  <span className="col-price">${Number(item.unitPrice).toFixed(2)}</span>
                  <span className="col-total">${Number(item.totalPrice).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="totals-section">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>${Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div className="totals-row">
              <span>Tax ({Number(invoice.taxRate)}%)</span>
              <span>${Number(invoice.tax).toFixed(2)}</span>
            </div>
            <div className="totals-row total">
              <span>Total</span>
              <span>${Number(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="form-section">
          <h2 className="section-title">Notes & Terms</h2>
          <div className="form-grid">
            <div className="form-field full-width">
              <label className="field-label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="field-textarea"
                rows={3}
                placeholder="Internal notes..."
              />
            </div>

            <div className="form-field full-width">
              <label className="field-label">Payment Terms</label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="field-textarea"
                rows={3}
                placeholder="Payment terms and conditions..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="actions-section">
          <button
            type="button"
            onClick={() => router.push(`/invoices/${invoiceId}`)}
            className="btn-cancel"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-submit"
            disabled={saving || (isDraft && !formData.title)}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Add Line Item Modal */}
      {showLineItemModal && (
        <div className="modal-overlay" onClick={() => setShowLineItemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Line Item</h3>
              <button onClick={() => setShowLineItemModal(false)} className="modal-close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label className="field-label">Item Type</label>
                <select
                  value={newLineItem.itemType}
                  onChange={(e) => setNewLineItem({ ...newLineItem, itemType: e.target.value as InvoiceLineItemType })}
                  className="field-input"
                >
                  <option value={InvoiceLineItemType.LABOR}>Labor</option>
                  <option value={InvoiceLineItemType.MATERIAL}>Material</option>
                  <option value={InvoiceLineItemType.SERVICE}>Service</option>
                  <option value={InvoiceLineItemType.OTHER}>Other</option>
                </select>
              </div>

              <div className="form-field">
                <label className="field-label">Description *</label>
                <textarea
                  value={newLineItem.description}
                  onChange={(e) => setNewLineItem({ ...newLineItem, description: e.target.value })}
                  className="field-textarea"
                  rows={3}
                  placeholder="Describe the item..."
                />
              </div>

              <div className="form-grid-modal">
                <div className="form-field">
                  <label className="field-label">Quantity</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newLineItem.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setNewLineItem({ ...newLineItem, quantity: value });
                      }
                    }}
                    className="field-input"
                    placeholder="1"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Unit Price ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newLineItem.unitPrice}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setNewLineItem({ ...newLineItem, unitPrice: value });
                      }
                    }}
                    className="field-input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="line-item-total">
                <span>Total:</span>
                <span className="total-value">${calculateLineItemTotal()}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowLineItemModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button
                onClick={handleAddLineItem}
                className="btn-primary"
                disabled={addingLineItem || !newLineItem.description}
              >
                {addingLineItem ? "Adding..." : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
