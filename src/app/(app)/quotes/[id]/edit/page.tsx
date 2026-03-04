"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { QuoteLineItemType, QuoteStatus } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import "../../new/new-quote.css";

interface Customer {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
}

interface LineItem {
  id?: string;
  itemType: QuoteLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  materialId?: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  description: string | null;
  status: QuoteStatus;
  taxRate: string | number;
  validUntil: string | null;
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
  lineItems: LineItem[];
}

export default function EditQuotePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const quoteId = params?.id;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    siteId: "",
    title: "",
    description: "",
    taxRate: "8.25",
    validUntil: "",
    notes: "",
    terms: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [currentLineItem, setCurrentLineItem] = useState<LineItem>({
    itemType: QuoteLineItemType.SERVICE,
    description: "",
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (quoteId) {
      fetchQuote();
      fetchCustomers();
    }
  }, [quoteId]);

  useEffect(() => {
    if (formData.customerId) {
      fetchSites(formData.customerId);
    } else {
      setSites([]);
    }
  }, [formData.customerId]);

  const fetchQuote = async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (response.ok) {
        const result = await response.json();
        const quoteData = result.data as Quote;
        setQuote(quoteData);

        // Check if quote is editable (cannot edit APPROVED or CONVERTED)
        if (quoteData.status === QuoteStatus.APPROVED || quoteData.status === QuoteStatus.CONVERTED) {
          toast.warning("Cannot edit APPROVED or CONVERTED quotes.");
          router.push(`/quotes/${quoteId}`);
          return;
        }

        // Populate form data
        setFormData({
          customerId: quoteData.customer.id,
          siteId: quoteData.site?.id || "",
          title: quoteData.title,
          description: quoteData.description || "",
          taxRate: String(quoteData.taxRate),
          validUntil: quoteData.validUntil ? quoteData.validUntil.split("T")[0] : "",
          notes: quoteData.notes || "",
          terms: quoteData.terms || "",
        });

        // Populate line items
        setLineItems(
          quoteData.lineItems.map((item) => ({
            id: item.id,
            itemType: item.itemType,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            materialId: item.materialId,
          }))
        );
      } else {
        console.error("Failed to fetch quote");
        router.push("/quotes");
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
      router.push("/quotes");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
      if (response.ok) {
        const result = await response.json();
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const fetchSites = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}/sites`);
      if (response.ok) {
        const result = await response.json();
        setSites(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch sites:", error);
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
      itemType: QuoteLineItemType.SERVICE,
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
    if (!formData.customerId || !formData.title || lineItems.length === 0) {
      toast.warning("Please fill in all required fields and add at least one line item");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          siteId: formData.siteId || null,
          taxRate: parseFloat(formData.taxRate),
          validUntil: formData.validUntil || null,
          notes: formData.notes || null,
          terms: formData.terms || null,
          lineItems: lineItems.map((item) => ({
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            materialId: item.materialId || null,
          })),
        }),
      });

      if (response.ok) {
        router.push(`/quotes/${quoteId}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update quote");
      }
    } catch (error) {
      console.error("Failed to update quote:", error);
      toast.error("Failed to update quote");
    } finally {
      setSaving(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  if (loading) {
    return (
      <div className="new-quote-page">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
          <div className="spinner-sm" style={{ width: "32px", height: "32px", borderWidth: "3px" }}></div>
          <span style={{ marginLeft: "1rem", color: "var(--text-secondary)" }}>Loading quote...</span>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="new-quote-page">
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <p>Quote not found</p>
          <button onClick={() => router.push("/quotes")} className="btn-primary">
            Back to Quotes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="new-quote-page">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => router.push(`/quotes/${quoteId}`)} className="back-button">
          <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Quote
        </button>
        <h1 className="page-title">Edit Quote {quote.quoteNumber}</h1>
        <p className="page-subtitle">Modify the quote details and line items</p>
      </div>

      <div className="form-container">
        {/* Customer Section */}
        <div className="form-section">
          <div className="section-header">
            <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="section-title">Customer Information</h2>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label className="field-label">
                Customer *
                <span className="field-required">Required</span>
              </label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value, siteId: "" })}
                className="field-input"
                required
                disabled
              >
                <option value="">Select customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <p className="field-hint">Customer cannot be changed after quote creation</p>
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
              {formData.customerId && sites.length === 0 && (
                <p className="field-hint">No sites available for this customer</p>
              )}
            </div>
          </div>
        </div>

        {/* Quote Details Section */}
        <div className="form-section">
          <div className="section-header">
            <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="section-title">Quote Details</h2>
          </div>

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
                placeholder="e.g., Annual Pump Maintenance & Inspection"
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
                placeholder="Additional details about this quote..."
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
                placeholder="8.25"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Valid Until</label>
              <input
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                className="field-input"
              />
            </div>
          </div>
        </div>

        {/* Line Items Section */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-header-left">
              <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <h2 className="section-title">Line Items</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowLineItemModal(true)}
              className="btn-secondary"
            >
              <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Item
            </button>
          </div>

          {lineItems.length === 0 ? (
            <div className="empty-state-small">
              <svg className="empty-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>No items added yet</p>
              <button
                type="button"
                onClick={() => setShowLineItemModal(true)}
                className="btn-text"
              >
                Add your first item to get started
              </button>
            </div>
          ) : (
            <div className="line-items-table">
              {lineItems.map((item, index) => (
                <div key={index} className="line-item-row">
                  <div className="line-item-main">
                    <div className="line-item-type">{item.itemType}</div>
                    <div className="line-item-description">{item.description}</div>
                    <div className="line-item-details">
                      <span>{item.quantity} x ${item.unitPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="line-item-actions">
                    <div className="line-item-total">${item.totalPrice.toFixed(2)}</div>
                    <button
                      type="button"
                      onClick={() => handleEditLineItem(index)}
                      className="action-button edit"
                    >
                      <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(index)}
                      className="action-button delete"
                    >
                      <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals Section */}
        {lineItems.length > 0 && (
          <div className="totals-section">
            <div className="totals-row">
              <span className="totals-label">Subtotal</span>
              <span className="totals-value">${subtotal.toFixed(2)}</span>
            </div>
            <div className="totals-row">
              <span className="totals-label">Tax ({formData.taxRate}%)</span>
              <span className="totals-value">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="totals-row total">
              <span className="totals-label">Total</span>
              <span className="totals-value">${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Notes & Terms Section */}
        <div className="form-section">
          <div className="section-header">
            <svg className="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <h2 className="section-title">Notes & Terms</h2>
          </div>

          <div className="form-grid">
            <div className="form-field full-width">
              <label className="field-label">Internal Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="field-textarea"
                rows={3}
                placeholder="Internal notes (not visible to customer)..."
              />
            </div>

            <div className="form-field full-width">
              <label className="field-label">Terms & Conditions</label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="field-textarea"
                rows={3}
                placeholder="Terms and conditions..."
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="actions-section">
          <button
            type="button"
            onClick={() => router.push(`/quotes/${quoteId}`)}
            className="btn-cancel"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-submit"
            disabled={saving || !formData.customerId || !formData.title || lineItems.length === 0}
          >
            {saving ? (
              <>
                <div className="spinner-sm"></div>
                Saving Changes...
              </>
            ) : (
              <>
                <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Line Item Modal */}
      {showLineItemModal && (
        <div className="modal-overlay" onClick={() => resetLineItemForm()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingIndex !== null ? "Edit Line Item" : "Add Line Item"}
              </h3>
              <button onClick={() => resetLineItemForm()} className="modal-close">
                <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label className="field-label">Item Type</label>
                <select
                  value={currentLineItem.itemType}
                  onChange={(e) => setCurrentLineItem({ ...currentLineItem, itemType: e.target.value as QuoteLineItemType })}
                  className="field-input"
                >
                  <option value={QuoteLineItemType.SERVICE}>Service</option>
                  <option value={QuoteLineItemType.MATERIAL}>Material</option>
                  <option value={QuoteLineItemType.OTHER}>Other</option>
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
                  required
                />
              </div>

              <div className="form-grid">
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
                    placeholder="0"
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

              <div className="item-total-preview">
                <span>Item Total:</span>
                <span className="total-amount">
                  ${(currentLineItem.quantity * currentLineItem.unitPrice).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => resetLineItemForm()}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
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
