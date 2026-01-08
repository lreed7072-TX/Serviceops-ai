"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";

type Customer = { id: string; name: string };
type Site = { id: string; name: string; customerId: string };
type Material = { id: string; name: string; partNumber: string; unitCost: number };
type Quote = {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  total: number;
  validUntil: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  site: { id: string; name: string } | null;
  _count?: { lineItems: number };
  lineItems?: any[];
};

type LineItem = {
  id: string;
  itemType: "LABOR" | "MATERIAL" | "SERVICE" | "OTHER";
  description: string;
  quantity: number;
  unitPrice: number;
  materialId?: string;
};

const statusColors: Record<string, string> = {
  DRAFT: "gray",
  SENT: "blue",
  APPROVED: "green",
  REJECTED: "red",
  EXPIRED: "orange",
  CONVERTED: "purple",
};

const itemTypeLabels: Record<string, string> = {
  LABOR: "Labor",
  MATERIAL: "Material",
  SERVICE: "Service",
  OTHER: "Other",
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Material search state
  const [materialSearch, setMaterialSearch] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    siteId: "",
    title: "",
    description: "",
    validUntil: "",
    laborRate: "85.00",
    materialMarkupPercent: "15.00",
    notes: "",
    terms: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New line item state
  const [newItem, setNewItem] = useState<LineItem>({
    id: "",
    itemType: "LABOR",
    description: "",
    quantity: 1,
    unitPrice: 85.00,
    materialId: undefined,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [qRes, cRes, sRes, mRes] = await Promise.all([
        apiFetch("/api/quotes", { cache: "no-store" }),
        apiFetch("/api/customers", { cache: "no-store" }),
        apiFetch("/api/sites", { cache: "no-store" }),
        apiFetch("/api/materials", { cache: "no-store" }),
      ]);
      if (qRes.ok) setQuotes((await qRes.json()).data ?? []);
      if (cRes.ok) setCustomers((await cRes.json()).data ?? []);
      if (sRes.ok) setSites((await sRes.json()).data ?? []);
      if (mRes.ok) setMaterials((await mRes.json()).data ?? []);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Sync newItem.unitPrice with laborRate when itemType is LABOR
  useEffect(() => {
    if (newItem.itemType === "LABOR") {
      const rate = parseFloat(formData.laborRate) || 0;
      setNewItem(prev => ({ ...prev, unitPrice: rate }));
    }
  }, [formData.laborRate, newItem.itemType]);

  const filteredSites = formData.customerId
    ? sites.filter((s) => s.customerId === formData.customerId)
    : sites;

  // Filter materials based on search
  const filteredMaterials = materialSearch.trim()
    ? materials.filter(m => 
        m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        (m.partNumber && m.partNumber.toLowerCase().includes(materialSearch.toLowerCase()))
      )
    : materials;

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxRate = 0;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  // Add line item
  const addLineItem = () => {
    if (!newItem.description.trim()) {
      setFormError("Line item description is required");
      return;
    }
    if (newItem.quantity <= 0) {
      setFormError("Quantity must be greater than 0");
      return;
    }
    setFormError(null);
    
    // Apply material markup if it's a MATERIAL type and user hasn't selected from catalog
    let finalUnitPrice = newItem.unitPrice;
    if (newItem.itemType === "MATERIAL" && !newItem.materialId && newItem.unitPrice > 0) {
      const markup = parseFloat(formData.materialMarkupPercent) || 0;
      finalUnitPrice = newItem.unitPrice * (1 + markup / 100);
      finalUnitPrice = Math.round(finalUnitPrice * 100) / 100;
    }
    
    setLineItems([...lineItems, { ...newItem, unitPrice: finalUnitPrice, id: crypto.randomUUID() }]);
    
    // Reset to LABOR with current labor rate
    const rate = parseFloat(formData.laborRate) || 0;
    setNewItem({
      id: "",
      itemType: "LABOR",
      description: "",
      quantity: 1,
      unitPrice: rate,
      materialId: undefined,
    });
    setMaterialSearch(""); // Clear search
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  // Update existing line item
  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // Handle material selection from catalog
  const handleMaterialSelect = (materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    if (material) {
      const baseCost = parseFloat(String(material.unitCost)) || 0;
      const markup = parseFloat(formData.materialMarkupPercent) || 0;
      const markedUpPrice = baseCost * (1 + markup / 100);
      setNewItem({
        ...newItem,
        itemType: "MATERIAL",
        description: `${material.name}${material.partNumber ? ` (${material.partNumber})` : ''}`,
        unitPrice: Math.round(markedUpPrice * 100) / 100,
        materialId: material.id,
      });
      setMaterialSearch(""); // Clear search after selection
    }
  };

  // Update unit price when item type changes
  const handleItemTypeChange = (itemType: LineItem["itemType"]) => {
    let unitPrice = newItem.unitPrice;
    if (itemType === "LABOR") {
      unitPrice = parseFloat(formData.laborRate) || 0;
    } else if (itemType === "MATERIAL") {
      unitPrice = 0;
    } else {
      unitPrice = 0;
    }
    setNewItem({ ...newItem, itemType, unitPrice, materialId: undefined });
    setMaterialSearch(""); // Clear search
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.title.trim()) {
      setFormError("Customer and title are required");
      return;
    }
    if (lineItems.length === 0) {
      setFormError("Please add at least one line item to the quote");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      // Create the quote
      const res = await apiFetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          siteId: formData.siteId || null,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          validUntil: formData.validUntil || null,
          laborRate: parseFloat(formData.laborRate) || null,
          materialMarkupPercent: parseFloat(formData.materialMarkupPercent) || null,
          notes: formData.notes.trim() || null,
          terms: formData.terms.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create quote");
      
      const { data: quote } = await res.json();
      
      // Add all line items
      for (const item of lineItems) {
        const itemRes = await apiFetch(`/api/quotes/${quote.id}/line-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            materialId: item.materialId || null,
          }),
        });
        if (!itemRes.ok) {
          console.error("Failed to add line item:", await itemRes.json());
        }
      }
      
      // Reset form
      setShowForm(false);
      setFormData({
        customerId: "",
        siteId: "",
        title: "",
        description: "",
        validUntil: "",
        laborRate: "85.00",
        materialMarkupPercent: "15.00",
        notes: "",
        terms: "",
      });
      setLineItems([]);
      setMaterialSearch("");
      await loadData();
    } catch (e: any) {
      setFormError(e?.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  const cancelForm = () => {
    setShowForm(false);
    setFormData({
      customerId: "",
      siteId: "",
      title: "",
      description: "",
      validUntil: "",
      laborRate: "85.00",
      materialMarkupPercent: "15.00",
      notes: "",
      terms: "",
    });
    setLineItems([]);
    setMaterialSearch("");
    setFormError(null);
  };

  return (
    <div>
      <PageHeader title="Quotes" subtitle="Create and manage customer quotes" />

      {error && <div className="page-alert error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Quotes</h3>
          <button className="btn btn-primary" onClick={() => showForm ? cancelForm() : setShowForm(true)}>
            {showForm ? "Cancel" : "+ New Quote"}
          </button>
        </div>

        {showForm && (
          <form className="quote-form" onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 20, background: "var(--card-muted)", borderRadius: 8 }}>
            {/* Section 1: Basic Info */}
            <h4 style={{ marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>Quote Details</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <label className="form-field">
                <span>Customer *</span>
                <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value, siteId: "" })} required>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Site (optional)</span>
                <select value={formData.siteId} onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}>
                  <option value="">No specific site</option>
                  {filteredSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            <label className="form-field" style={{ marginBottom: 16 }}>
              <span>Quote Title *</span>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Pump Repair Service Quote" required />
            </label>
            <label className="form-field" style={{ marginBottom: 16 }}>
              <span>Description</span>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Scope of work, special conditions, etc." rows={2} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
              <label className="form-field">
                <span>Labor Rate ($/hr)</span>
                <input type="number" step="0.01" min="0" value={formData.laborRate} onChange={(e) => setFormData({ ...formData, laborRate: e.target.value })} />
              </label>
              <label className="form-field">
                <span>Material Markup (%)</span>
                <input type="number" step="0.01" min="0" value={formData.materialMarkupPercent} onChange={(e) => setFormData({ ...formData, materialMarkupPercent: e.target.value })} />
              </label>
              <label className="form-field">
                <span>Valid Until</span>
                <input type="date" value={formData.validUntil} onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} />
              </label>
            </div>

            {/* Section 2: Line Items */}
            <h4 style={{ marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>Line Items</h4>
            
            {/* Add new line item */}
            <div style={{ background: "var(--bg)", padding: 16, borderRadius: 8, marginBottom: 16, border: "1px solid var(--border)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px 120px auto", gap: 12, alignItems: "end" }}>
                <label className="form-field">
                  <span>Type</span>
                  <select value={newItem.itemType} onChange={(e) => handleItemTypeChange(e.target.value as LineItem["itemType"])}>
                    <option value="LABOR">Labor</option>
                    <option value="MATERIAL">Material</option>
                    <option value="SERVICE">Service</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Description</span>
                  <input type="text" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder={newItem.itemType === "LABOR" ? "e.g., Field technician time" : "Item description"} />
                </label>
                <label className="form-field">
                  <span>{newItem.itemType === "LABOR" ? "Hours" : "Qty"}</span>
                  <input type="number" step="0.5" min="0.5" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="form-field">
                  <span>Unit Price</span>
                  <input type="number" step="0.01" min="0" value={newItem.unitPrice} onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })} />
                </label>
                <button type="button" className="btn btn-primary" onClick={addLineItem} style={{ marginBottom: 0 }}>Add</button>
              </div>
              
              {/* Material catalog selector with SEARCH */}
              {newItem.itemType === "MATERIAL" && materials.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label className="form-field">
                    <span>Or search and select from catalog ({formData.materialMarkupPercent}% markup will be applied):</span>
                    <input 
                      type="text" 
                      placeholder="Type to search materials..." 
                      value={materialSearch}
                      onChange={(e) => setMaterialSearch(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    {materialSearch.trim() && filteredMaterials.length > 0 && (
                      <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)" }}>
                        {filteredMaterials.map((m) => {
                          const baseCost = parseFloat(String(m.unitCost)) || 0;
                          const markup = parseFloat(formData.materialMarkupPercent) || 0;
                          const markedUpPrice = baseCost * (1 + markup / 100);
                          return (
                            <div 
                              key={m.id} 
                              onClick={() => handleMaterialSelect(m.id)}
                              style={{ 
                                padding: "8px 12px", 
                                cursor: "pointer",
                                borderBottom: "1px solid var(--border)",
                                transition: "background 0.15s"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "var(--card-muted)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg)"}
                            >
                              <div style={{ fontWeight: 500 }}>{m.name} {m.partNumber ? `(${m.partNumber})` : ''}</div>
                              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                Base: {formatCurrency(baseCost)} → With {formData.materialMarkupPercent}% Markup: {formatCurrency(markedUpPrice)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {materialSearch.trim() && filteredMaterials.length === 0 && (
                      <div style={{ padding: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No materials found matching "{materialSearch}"</div>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* Line items table - EDITABLE */}
            {lineItems.length > 0 ? (
              <table className="table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Type</th>
                    <th>Description</th>
                    <th style={{ width: 80, textAlign: "right" }}>Qty</th>
                    <th style={{ width: 120, textAlign: "right" }}>Unit Price</th>
                    <th style={{ width: 100, textAlign: "right" }}>Total</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td><span className={`status-badge ${item.itemType === "LABOR" ? "blue" : item.itemType === "MATERIAL" ? "green" : "gray"}`}>{itemTypeLabels[item.itemType]}</span></td>
                      <td>
                        <input 
                          type="text" 
                          value={item.description} 
                          onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                          style={{ width: "100%", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)" }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input 
                          type="number" 
                          step="0.5"
                          min="0.5"
                          value={item.quantity} 
                          onChange={(e) => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          style={{ width: "70px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          value={item.unitPrice} 
                          onChange={(e) => updateLineItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                          style={{ width: "100px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 500 }}>{formatCurrency(item.quantity * item.unitPrice)}</td>
                      <td>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLineItem(item.id)} style={{ padding: "4px 8px", fontSize: 12 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted" style={{ marginBottom: 16, textAlign: "center", padding: 20 }}>No line items added yet. Add labor, materials, or services above.</p>
            )}

            {/* Totals section */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
              <div style={{ width: 280, background: "var(--bg)", padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>Subtotal:</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "var(--text-muted)" }}>
                  <span>Tax (0%):</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "2px solid var(--border)", fontSize: 18, fontWeight: 600 }}>
                  <span>Total:</span>
                  <span style={{ color: "var(--primary)" }}>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Section 3: Notes & Terms */}
            <h4 style={{ marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>Notes & Terms</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <label className="form-field">
                <span>Internal Notes</span>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Notes for internal use (not shown to customer)" rows={3} />
              </label>
              <label className="form-field">
                <span>Terms & Conditions</span>
                <textarea value={formData.terms} onChange={(e) => setFormData({ ...formData, terms: e.target.value })} placeholder="Payment terms, warranty info, etc." rows={3} />
              </label>
            </div>

            {formError && <p className="form-feedback error" style={{ marginBottom: 16 }}>{formError}</p>}
            
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={saving || lineItems.length === 0}>
                {saving ? "Creating..." : `Create Quote (${formatCurrency(total)})`}
              </button>
              <button type="button" className="btn" onClick={cancelForm}>Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <p>Loading quotes...</p>
        ) : quotes.length === 0 && !showForm ? (
          <p className="muted">No quotes yet. Click "+ New Quote" to create one.</p>
        ) : !showForm && (
          <table className="table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Title</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Items</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.quoteNumber}</strong></td>
                  <td>{q.title}</td>
                  <td>{q.customer.name}</td>
                  <td><span className={`status-badge ${statusColors[q.status]}`}>{q.status}</span></td>
                  <td>{q._count?.lineItems ?? q.lineItems?.length ?? 0} items</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{formatCurrency(Number(q.total))}</td>
                  <td>{formatDate(q.createdAt)}</td>
                  <td><Link href={`/quotes/${q.id}`} className="link-button">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
