"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InvoiceLineItemType } from "@prisma/client";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import "./new-invoice.css";

interface Customer {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
}

interface WorkOrder {
  id: string;
  workOrderNumber: string | null;
  title: string;
}

interface LineItem {
  itemType: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedWorkOrderId = searchParams?.get("workOrderId");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    siteId: "",
    workOrderId: preselectedWorkOrderId || "",
    title: "",
    description: "",
    taxRate: "0",
    dueDate: "",
    notes: "",
    terms: "Payment due within 30 days.",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [currentLineItem, setCurrentLineItem] = useState<LineItem>({
    itemType: InvoiceLineItemType.LABOR,
    description: "",
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.customerId) {
      fetchSites(formData.customerId);
      fetchWorkOrders(formData.customerId);
    } else {
      setSites([]);
      setWorkOrders([]);
    }
  }, [formData.customerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const customersRes = await apiFetch("/api/customers");
      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.data || []);
      }

      // If we have a preselected work order, fetch its details
      if (preselectedWorkOrderId) {
        const woRes = await apiFetch(`/api/work-orders/${preselectedWorkOrderId}`);
        if (woRes.ok) {
          const woData = await woRes.json();
          const wo = woData.data;
          setFormData(prev => ({
            ...prev,
            customerId: wo.customer?.id || "",
            siteId: wo.site?.id || "",
            workOrderId: wo.id,
            title: `Invoice for ${wo.workOrderNumber || wo.title}`,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async (customerId: string) => {
    try {
      const response = await apiFetch(`/api/customers/${customerId}/sites`);
      if (response.ok) {
        const data = await response.json();
        setSites(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch sites:", error);
    }
  };

  const fetchWorkOrders = async (customerId: string) => {
    try {
      const response = await apiFetch(`/api/work-orders?customerId=${customerId}&status=COMPLETED`);
      if (response.ok) {
        const data = await response.json();
        setWorkOrders(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch work orders:", error);
    }
  };

  const handleAddLineItem = () => {
    const totalPrice = currentLineItem.quantity * currentLineItem.unitPrice;
    const itemWithTotal = { ...currentLineItem, totalPrice };

    if (editingIndex !== null) {
      const updated = [...lineItems];
      updated[editingIndex] = itemWithTotal;
      setLineItems(updated);
      setEditingIndex(null);
    } else {
      setLineItems([...lineItems, itemWithTotal]);
    }

    resetLineItemForm();
  };

  const resetLineItemForm = () => {
    setCurrentLineItem({
      itemType: InvoiceLineItemType.LABOR,
      description: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    });
    setShowLineItemModal(false);
    setEditingIndex(null);
  };

  const handleEditLineItem = (index: number) => {
    setCurrentLineItem(lineItems[index]);
    setEditingIndex(index);
    setShowLineItemModal(true);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = parseFloat(formData.taxRate) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async () => {
    if (!formData.customerId || !formData.title) {
      alert("Please select a customer and enter a title");
      return;
    }

    setSubmitting(true);
    try {
      // Create the invoice
      const invoiceRes = await apiFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          siteId: formData.siteId || null,
          workOrderId: formData.workOrderId || null,
          title: formData.title,
          description: formData.description || null,
          taxRate: parseFloat(formData.taxRate) || 0,
          dueDate: formData.dueDate || null,
          notes: formData.notes || null,
          terms: formData.terms || null,
        }),
      });

      if (!invoiceRes.ok) {
        const error = await invoiceRes.json();
        throw new Error(error.error || "Failed to create invoice");
      }

      const invoiceData = await invoiceRes.json();
      const invoiceId = invoiceData.data.id;

      // Add line items
      for (const item of lineItems) {
        await apiFetch(`/api/invoices/${invoiceId}/line-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }),
        });
      }

      router.push(`/invoices/${invoiceId}`);
    } catch (error) {
      console.error("Failed to create invoice:", error);
      alert(error instanceof Error ? error.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  if (loading) {
    return (
      <div className="new-invoice-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="new-invoice-page">
      {/* Header */}
      <div className="page-header">
        <Link href="/invoices" className="back-link">
          ← Back to Invoices
        </Link>
        <h1>Create New Invoice</h1>
        <p className="page-subtitle">Create a professional invoice for your customer</p>
      </div>

      <div className="form-container">
        {/* Customer Section */}
        <div className="form-section">
          <h2 className="section-title">Customer Information</h2>
          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">
                Customer *
                <span className="field-required">Required</span>
              </label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value, siteId: "", workOrderId: "" })}
                className="field-input"
                required
              >
                <option value="">Select customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Site (Optional)</label>
              <select
                value={formData.siteId}
                onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                className="field-input"
                disabled={!formData.customerId || sites.length === 0}
              >
                <option value="">No specific site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field full-width">
              <label className="field-label">Link to Work Order (Optional)</label>
              <select
                value={formData.workOrderId}
                onChange={(e) => setFormData({ ...formData, workOrderId: e.target.value })}
                className="field-input"
                disabled={!formData.customerId || workOrders.length === 0}
              >
                <option value="">No linked work order</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.workOrderNumber || wo.title}
                  </option>
                ))}
              </select>
              {formData.customerId && workOrders.length === 0 && (
                <p className="field-hint">No completed work orders for this customer</p>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="form-section">
          <h2 className="section-title">Invoice Details</h2>
          <div className="form-grid">
            <div className="form-field full-width">
              <label className="field-label">
                Title *
                <span className="field-required">Required</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="field-input"
                placeholder="e.g., Pump Repair Services - January 2026"
                required
              />
            </div>

            <div className="form-field full-width">
              <label className="field-label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="field-textarea"
                rows={3}
                placeholder="Additional details about this invoice..."
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
            <button
              type="button"
              onClick={() => setShowLineItemModal(true)}
              className="btn-secondary"
            >
              + Add Item
            </button>
          </div>

          {lineItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <p>No items added yet</p>
              <button onClick={() => setShowLineItemModal(true)} className="btn-text">
                Add your first line item
              </button>
            </div>
          ) : (
            <div className="line-items-list">
              {lineItems.map((item, index) => (
                <div key={index} className="line-item-row">
                  <div className="line-item-main">
                    <span className={`type-badge ${item.itemType.toLowerCase()}`}>
                      {item.itemType}
                    </span>
                    <div className="line-item-desc">{item.description}</div>
                    <div className="line-item-details">
                      {item.quantity} x ${item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="line-item-actions">
                    <span className="line-item-total">${item.totalPrice.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleEditLineItem(index)}
                      className="action-btn edit"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(index)}
                      className="action-btn delete"
                      title="Remove"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        {lineItems.length > 0 && (
          <div className="totals-section">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="totals-row">
              <span>Tax ({formData.taxRate}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <div className="totals-row total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        )}

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
            onClick={() => router.push("/invoices")}
            className="btn-cancel"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-submit"
            disabled={submitting || !formData.customerId || !formData.title}
          >
            {submitting ? "Creating..." : "Create Invoice"}
          </button>
        </div>
      </div>

      {/* Line Item Modal */}
      {showLineItemModal && (
        <div className="modal-overlay" onClick={() => resetLineItemForm()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingIndex !== null ? "Edit Line Item" : "Add Line Item"}</h3>
              <button onClick={() => resetLineItemForm()} className="modal-close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label className="field-label">Item Type</label>
                <select
                  value={currentLineItem.itemType}
                  onChange={(e) => setCurrentLineItem({ ...currentLineItem, itemType: e.target.value as InvoiceLineItemType })}
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
                  value={currentLineItem.description}
                  onChange={(e) => setCurrentLineItem({ ...currentLineItem, description: e.target.value })}
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
                    value={currentLineItem.quantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setCurrentLineItem({ ...currentLineItem, quantity: value === "" ? 0 : parseFloat(value) || 0 });
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
                    value={currentLineItem.unitPrice}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setCurrentLineItem({ ...currentLineItem, unitPrice: value === "" ? 0 : parseFloat(value) || 0 });
                      }
                    }}
                    className="field-input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="line-item-preview">
                <span>Item Total:</span>
                <span className="preview-total">
                  ${(currentLineItem.quantity * currentLineItem.unitPrice).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => resetLineItemForm()} className="btn-cancel">
                Cancel
              </button>
              <button
                onClick={handleAddLineItem}
                className="btn-primary"
                disabled={!currentLineItem.description}
              >
                {editingIndex !== null ? "Update Item" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
