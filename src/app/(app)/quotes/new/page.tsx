"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuoteLineItemType } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import "./new-quote.css";

interface CatalogMaterial {
  id: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  unitCost: number | null;
  unit: string | null;
}

interface Customer {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
}

interface LineItem {
  itemType: QuoteLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  materialId?: string;
}

export default function NewQuotePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    siteId: "",
    title: "",
    description: "",
    taxRate: "8.25",
    validUntil: "",
    notes: "",
    terms: "Payment due within 30 days of work order completion.",
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

  // Material catalog search state
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialResults, setMaterialResults] = useState<CatalogMaterial[]>([]);
  const [searchingMaterials, setSearchingMaterials] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<CatalogMaterial | null>(null);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const materialSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const materialDropdownRef = useRef<HTMLDivElement>(null);

  const searchMaterials = useCallback(async (term: string) => {
    if (!term.trim()) {
      setMaterialResults([]);
      setShowMaterialDropdown(false);
      return;
    }
    setSearchingMaterials(true);
    try {
      const res = await fetch(`/api/materials?search=${encodeURIComponent(term)}&isActive=true&limit=10`);
      if (res.ok) {
        const result = await res.json();
        setMaterialResults(result.data || []);
        setShowMaterialDropdown(true);
      }
    } catch {
      // silently fail
    } finally {
      setSearchingMaterials(false);
    }
  }, []);

  const handleMaterialSearchChange = (value: string) => {
    setMaterialSearch(value);
    if (materialSearchTimer.current) clearTimeout(materialSearchTimer.current);
    materialSearchTimer.current = setTimeout(() => searchMaterials(value), 300);
  };

  const selectMaterial = (mat: CatalogMaterial) => {
    setSelectedMaterial(mat);
    setShowMaterialDropdown(false);
    setMaterialSearch("");
    const desc = mat.partNumber ? `${mat.name} (P/N: ${mat.partNumber})` : mat.name;
    setCurrentLineItem(prev => ({
      ...prev,
      materialId: mat.id,
      description: desc,
      unitPrice: mat.unitCost ?? prev.unitPrice,
    }));
  };

  const clearMaterialSelection = () => {
    setSelectedMaterial(null);
    setCurrentLineItem(prev => ({ ...prev, materialId: undefined }));
  };

  // Site creation modal state
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: "", address: "", city: "", state: "", postalCode: "" });
  const [siteModalSaving, setSiteModalSaving] = useState(false);
  const [siteModalError, setSiteModalError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (formData.customerId) {
      fetchSites(formData.customerId);
    } else {
      setSites([]);
      setFormData(prev => ({ ...prev, siteId: "" }));
    }
  }, [formData.customerId]);

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
      const response = await fetch(`/api/sites?customerId=${customerId}`);
      if (response.ok) {
        const result = await response.json();
        setSites(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch sites:", error);
    }
  };

  const handleSiteSelectChange = (value: string) => {
    if (value === "__add_site__") {
      setSiteForm({ name: "", address: "", city: "", state: "", postalCode: "" });
      setSiteModalError(null);
      setShowSiteModal(true);
      return;
    }
    setFormData(prev => ({ ...prev, siteId: value }));
  };

  const handleSiteModalSubmit = async () => {
    if (!siteForm.name.trim()) {
      setSiteModalError("Site name is required.");
      return;
    }
    setSiteModalSaving(true);
    setSiteModalError(null);
    try {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          name: siteForm.name.trim(),
          address: siteForm.address.trim() || null,
          city: siteForm.city.trim() || null,
          state: siteForm.state.trim() || null,
          postalCode: siteForm.postalCode.trim() || null,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.detail || "Failed to create site.");
      }
      const result = await response.json();
      const newSite = result.data;
      await fetchSites(formData.customerId);
      setFormData(prev => ({ ...prev, siteId: newSite.id }));
      setShowSiteModal(false);
    } catch (e: any) {
      setSiteModalError(e.message || "Failed to create site.");
    } finally {
      setSiteModalSaving(false);
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
    setSelectedMaterial(null);
    setMaterialSearch("");
    setMaterialResults([]);
    setShowMaterialDropdown(false);
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

    setLoading(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          taxRate: parseFloat(formData.taxRate),
          lineItems,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/quotes/${result.data.id}`);
      } else {
        toast.error("Failed to create quote");
      }
    } catch (error) {
      console.error("Failed to create quote:", error);
      toast.error("Failed to create quote");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="new-quote-page">
      {/* Header */}
      <div className="page-header">
        <button onClick={() => router.back()} className="back-button">
          <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Quotes
        </button>
        <h1 className="page-title">Create New Quote</h1>
        <p className="page-subtitle">Build a professional quote for your customer</p>
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
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
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
                onChange={(e) => handleSiteSelectChange(e.target.value)}
                className="field-input"
                disabled={!formData.customerId}
              >
                <option value="">No specific site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
                {formData.customerId && (
                  <option value="__add_site__">+ Add new site...</option>
                )}
              </select>
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
                  // Allow empty string, numbers, and decimal points
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
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
                    <div className="line-item-type">
                      {item.itemType}
                    </div>
                    <div className="line-item-description">
                      {item.description}
                    </div>
                    <div className="line-item-details">
                      <span>{item.quantity} × ${item.unitPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="line-item-actions">
                    <div className="line-item-total">
                      ${item.totalPrice.toFixed(2)}
                    </div>
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
            onClick={() => router.back()}
            className="btn-cancel"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-submit"
            disabled={loading || !formData.customerId || !formData.title || lineItems.length === 0}
          >
            {loading ? (
              <>
                <div className="spinner-sm"></div>
                Creating Quote...
              </>
            ) : (
              <>
                <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Create Quote
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Site Modal */}
      {showSiteModal && (
        <div className="modal-overlay" onClick={() => setShowSiteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Site</h3>
              <button onClick={() => setShowSiteModal(false)} className="modal-close">
                <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {siteModalError && <div className="alert-error" style={{ marginBottom: "1rem" }}>{siteModalError}</div>}
              <div className="form-field">
                <label className="field-label">Site Name *</label>
                <input
                  type="text"
                  value={siteForm.name}
                  onChange={(e) => setSiteForm(prev => ({ ...prev, name: e.target.value }))}
                  className="field-input"
                  placeholder="e.g., Main Plant, Pump Station #3"
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label className="field-label">Address</label>
                <input
                  type="text"
                  value={siteForm.address}
                  onChange={(e) => setSiteForm(prev => ({ ...prev, address: e.target.value }))}
                  className="field-input"
                  placeholder="Street address"
                />
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label className="field-label">City</label>
                  <input
                    type="text"
                    value={siteForm.city}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, city: e.target.value }))}
                    className="field-input"
                    placeholder="City"
                  />
                </div>
                <div className="form-field">
                  <label className="field-label">State</label>
                  <input
                    type="text"
                    value={siteForm.state}
                    onChange={(e) => setSiteForm(prev => ({ ...prev, state: e.target.value }))}
                    className="field-input"
                    placeholder="State"
                  />
                </div>
              </div>
              <div className="form-field">
                <label className="field-label">Postal Code</label>
                <input
                  type="text"
                  value={siteForm.postalCode}
                  onChange={(e) => setSiteForm(prev => ({ ...prev, postalCode: e.target.value }))}
                  className="field-input"
                  placeholder="Postal code"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowSiteModal(false)} className="btn-cancel" disabled={siteModalSaving}>
                Cancel
              </button>
              <button type="button" onClick={handleSiteModalSubmit} className="btn-primary" disabled={!siteForm.name.trim() || siteModalSaving}>
                {siteModalSaving ? "Creating..." : "Add Site"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onChange={(e) => {
                    const newType = e.target.value as QuoteLineItemType;
                    setCurrentLineItem({ ...currentLineItem, itemType: newType, materialId: undefined });
                    setSelectedMaterial(null);
                    setMaterialSearch("");
                    setMaterialResults([]);
                    setShowMaterialDropdown(false);
                  }}
                  className="field-input"
                >
                  <option value={QuoteLineItemType.SERVICE}>Service</option>
                  <option value={QuoteLineItemType.MATERIAL}>Material</option>
                  <option value={QuoteLineItemType.OTHER}>Other</option>
                </select>
              </div>

              {currentLineItem.itemType === QuoteLineItemType.MATERIAL && (
                <div className="form-field" ref={materialDropdownRef} style={{ position: "relative" }}>
                  <label className="field-label">Search Catalog (by name or part number)</label>
                  {selectedMaterial ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--background-secondary, #f3f4f6)", borderRadius: "var(--radius, 8px)", border: "1px solid var(--border, #e5e7eb)" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{selectedMaterial.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {selectedMaterial.partNumber && `P/N: ${selectedMaterial.partNumber}`}
                          {selectedMaterial.partNumber && selectedMaterial.manufacturer && " · "}
                          {selectedMaterial.manufacturer}
                        </div>
                      </div>
                      <button type="button" onClick={clearMaterialSelection} style={{ background: "none", border: "none", color: "var(--accent, #f97316)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}>
                        Clear
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={materialSearch}
                        onChange={(e) => handleMaterialSearchChange(e.target.value)}
                        className="field-input"
                        placeholder="Type to search materials..."
                        autoComplete="off"
                      />
                      {searchingMaterials && (
                        <div style={{ position: "absolute", right: "0.75rem", top: "2.2rem" }}>
                          <div className="spinner-sm" style={{ width: "16px", height: "16px", borderWidth: "2px" }}></div>
                        </div>
                      )}
                      {showMaterialDropdown && materialResults.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid var(--border, #e5e7eb)", borderRadius: "var(--radius, 8px)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "240px", overflowY: "auto" }}>
                          {materialResults.map((mat) => (
                            <div
                              key={mat.id}
                              onClick={() => selectMaterial(mat)}
                              style={{ padding: "0.6rem 0.75rem", cursor: "pointer", borderBottom: "1px solid #f3f4f6", transition: "background 0.1s" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                            >
                              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{mat.name}</div>
                              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", gap: "0.75rem" }}>
                                {mat.partNumber && <span>P/N: {mat.partNumber}</span>}
                                {mat.manufacturer && <span>{mat.manufacturer}</span>}
                                {mat.unitCost != null && <span>${mat.unitCost.toFixed(2)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {showMaterialDropdown && materialResults.length === 0 && materialSearch.trim() && !searchingMaterials && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "white", border: "1px solid var(--border, #e5e7eb)", borderRadius: "var(--radius, 8px)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "0.75rem", color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center" }}>
                          No materials found
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

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
                      // Allow empty string, numbers, and decimal points
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setCurrentLineItem({ ...currentLineItem, quantity: value === '' ? 0 : parseFloat(value) || 0 });
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
                      // Allow empty string, numbers, and decimal points
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setCurrentLineItem({ ...currentLineItem, unitPrice: value === '' ? 0 : parseFloat(value) || 0 });
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
