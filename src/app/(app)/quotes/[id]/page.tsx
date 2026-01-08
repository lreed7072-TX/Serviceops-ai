"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type LineItem = {
  id: string;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  material?: { id: string; name: string; partNumber: string | null } | null;
};

type Quote = {
  id: string;
  quoteNumber: string;
  title: string;
  description: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  laborRate: number | null;
  materialMarkupPercent: number | null;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  convertedToOrderId: string | null;
  convertedToOrderType: string | null;
  createdAt: string;
  customer: { id: string; name: string; primaryEmail: string | null };
  site: { id: string; name: string; address: string | null; city: string | null; state: string | null } | null;
  createdBy: { name: string | null; email: string };
  lineItems: LineItem[];
};

type Material = { id: string; name: string; partNumber: string | null; unitCost: number | null };

const ITEM_TYPES = ["LABOR", "MATERIAL", "SERVICE", "OTHER"];
const statusColors: Record<string, string> = { 
  DRAFT: "gray", 
  SENT: "blue", 
  APPROVED: "green", 
  REJECTED: "red", 
  EXPIRED: "orange", 
  CONVERTED: "purple" 
};

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params?.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Line item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");
  const [itemForm, setItemForm] = useState({ 
    itemType: "LABOR", 
    description: "", 
    quantity: "1", 
    unitPrice: "", 
    materialId: "" 
  });
  const [itemSaving, setItemSaving] = useState(false);

  // Action modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approverName, setApproverName] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertOrderType, setConvertOrderType] = useState("WORK_ORDER");

  const loadQuote = async () => {
    try {
      setLoading(true);
      const [qRes, mRes] = await Promise.all([
        apiFetch(`/api/quotes/${quoteId}`, { cache: "no-store" }),
        apiFetch("/api/materials?active=true", { cache: "no-store" }),
      ]);
      if (!qRes.ok) throw new Error("Quote not found");
      setQuote((await qRes.json()).data);
      if (mRes.ok) setMaterials((await mRes.json()).data ?? []);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (quoteId) loadQuote(); }, [quoteId]);

  // Filter materials based on search
  const filteredMaterials = materialSearch.trim()
    ? materials.filter(m => 
        m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        (m.partNumber && m.partNumber.toLowerCase().includes(materialSearch.toLowerCase()))
      )
    : [];

  const formatCurrency = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.description.trim() || !itemForm.unitPrice) return;
    setItemSaving(true);
    try {
      const res = await apiFetch(`/api/quotes/${quoteId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: itemForm.itemType,
          description: itemForm.description.trim(),
          quantity: parseFloat(itemForm.quantity) || 1,
          unitPrice: parseFloat(itemForm.unitPrice) || 0,
          materialId: itemForm.materialId || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowAddItem(false);
      setItemForm({ itemType: "LABOR", description: "", quantity: "1", unitPrice: "", materialId: "" });
      setMaterialSearch("");
      await loadQuote();
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteLineItem = async (itemId: string) => {
    if (!confirm("Delete this line item?")) return;
    try {
      await apiFetch(`/api/quotes/${quoteId}/line-items/${itemId}`, { method: "DELETE" });
      await loadQuote();
    } catch (e: any) {
      setError(e?.message);
    }
  };

  const handleAction = async (action: string, data?: any) => {
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/quotes/${quoteId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      if (action === "convert" && result.data?.workOrder) {
        router.push(`/work-orders/${result.data.workOrder.id}`);
      } else {
        await loadQuote();
      }
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setActionLoading(false);
      setShowApproveModal(false);
      setShowRejectModal(false);
      setShowConvertModal(false);
      setApproverName("");
      setRejectReason("");
    }
  };

  // Auto-fill from material with markup
  const handleMaterialSelect = (materialId: string) => {
    const mat = materials.find((m) => m.id === materialId);
    if (mat) {
      const baseCost = parseFloat(String(mat.unitCost)) || 0;
      const markup = quote?.materialMarkupPercent ? parseFloat(String(quote.materialMarkupPercent)) : 0;
      const markedUpPrice = baseCost * (1 + markup / 100);
      
      setItemForm({
        ...itemForm,
        materialId,
        description: mat.name + (mat.partNumber ? ` (${mat.partNumber})` : ""),
        unitPrice: (Math.round(markedUpPrice * 100) / 100).toString(),
        itemType: "MATERIAL",
      });
      setMaterialSearch("");
    }
  };

  if (loading) return <div className="page-container"><p>Loading...</p></div>;
  if (error && !quote) return <div className="page-container"><div className="page-alert error">{error}</div></div>;
  if (!quote) return <div className="page-container"><p>Quote not found</p></div>;

  const isDraft = quote.status === "DRAFT";
  const isSent = quote.status === "SENT";
  const isApproved = quote.status === "APPROVED";

  return (
    <div className="page-container">
      <div className="page-header-row">
        <Link href="/quotes" className="back-link">← Back to Quotes</Link>
      </div>

      {error && <div className="page-alert error">{error}</div>}

      {/* Quote Header */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ margin: 0 }}>{quote.quoteNumber}: {quote.title}</h2>
            <p className="muted">{quote.customer.name}{quote.site ? ` • ${quote.site.name}` : ""}</p>
          </div>
          <span className={`status-badge ${statusColors[quote.status]} large`}>{quote.status}</span>
        </div>
        
        {quote.description && <p style={{ marginTop: 12 }}>{quote.description}</p>}
        
        <div className="quote-meta" style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <span><strong>Created:</strong> {formatDate(quote.createdAt)} by {quote.createdBy.name || quote.createdBy.email}</span>
          {quote.validUntil && <span><strong>Valid Until:</strong> {formatDate(quote.validUntil)}</span>}
          {quote.laborRate && <span><strong>Labor Rate:</strong> {formatCurrency(Number(quote.laborRate))}/hr</span>}
          {quote.materialMarkupPercent && <span><strong>Material Markup:</strong> {Number(quote.materialMarkupPercent)}%</span>}
        </div>

        {quote.sentAt && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <strong>Sent:</strong> {formatDate(quote.sentAt)}
            {quote.customer.primaryEmail && ` to ${quote.customer.primaryEmail}`}
          </div>
        )}

        {quote.approvedAt && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <strong>Approved:</strong> {formatDate(quote.approvedAt)}
            {quote.approvedByName && ` by ${quote.approvedByName}`}
          </div>
        )}

        {quote.rejectedAt && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <strong>Rejected:</strong> {formatDate(quote.rejectedAt)}
            {quote.rejectionReason && (
              <div style={{ marginTop: 8, padding: 12, background: "var(--card-muted)", borderRadius: 4 }}>
                <em>{quote.rejectionReason}</em>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="quote-actions" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isDraft && (
            <button 
              className="btn btn-primary" 
              onClick={() => handleAction("send")} 
              disabled={actionLoading || quote.lineItems.length === 0}
              title={quote.lineItems.length === 0 ? "Add line items before sending" : ""}
            >
              Send to Customer
            </button>
          )}
          {isSent && (
            <>
              <button className="btn btn-success" onClick={() => setShowApproveModal(true)} disabled={actionLoading}>
                Mark Approved
              </button>
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)} disabled={actionLoading}>
                Mark Rejected
              </button>
              <button className="btn btn-secondary" onClick={() => handleAction("revert_to_draft")} disabled={actionLoading}>
                Revert to Draft
              </button>
            </>
          )}
          {isApproved && !quote.convertedToOrderId && (
            <button className="btn btn-primary" onClick={() => setShowConvertModal(true)} disabled={actionLoading}>
              Convert to Order
            </button>
          )}
          {quote.convertedToOrderId && (
            <Link href={`/work-orders/${quote.convertedToOrderId}`} className="btn btn-outline">
              View {quote.convertedToOrderType?.replace("_", " ")}
            </Link>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="card-header">
          <h3>Line Items</h3>
          {isDraft && (
            <button className="btn btn-outline" onClick={() => setShowAddItem(!showAddItem)}>
              {showAddItem ? "Cancel" : "+ Add Item"}
            </button>
          )}
        </div>

        {showAddItem && (
          <form onSubmit={handleAddLineItem} style={{ marginBottom: 16, padding: 16, background: "var(--card-muted)", borderRadius: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
              <label className="form-field">
                <span>Type</span>
                <select value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>Description *</span>
                <input 
                  type="text" 
                  value={itemForm.description} 
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} 
                  placeholder={itemForm.itemType === "LABOR" ? "e.g., Field technician time" : "Item description"}
                  required 
                />
              </label>
            </div>

            {/* Material catalog search */}
            {itemForm.itemType === "MATERIAL" && materials.length > 0 && (
              <label className="form-field" style={{ marginBottom: 12 }}>
                <span>Or search catalog ({quote.materialMarkupPercent || 0}% markup will be applied):</span>
                <input 
                  type="text" 
                  placeholder="Type to search materials..." 
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                />
                {materialSearch.trim() && filteredMaterials.length > 0 && (
                  <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg)", marginTop: 8 }}>
                    {filteredMaterials.map((m) => {
                      const baseCost = parseFloat(String(m.unitCost)) || 0;
                      const markup = quote.materialMarkupPercent ? parseFloat(String(quote.materialMarkupPercent)) : 0;
                      const markedUpPrice = baseCost * (1 + markup / 100);
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => handleMaterialSelect(m.id)}
                          style={{ 
                            padding: "8px 12px", 
                            cursor: "pointer",
                            borderBottom: "1px solid var(--border)"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--card-muted)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg)"}
                        >
                          <div style={{ fontWeight: 500 }}>{m.name} {m.partNumber ? `(${m.partNumber})` : ''}</div>
                          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                            Base: {formatCurrency(baseCost)} → With {quote.materialMarkupPercent || 0}% Markup: {formatCurrency(markedUpPrice)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {materialSearch.trim() && filteredMaterials.length === 0 && (
                  <div style={{ padding: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 8 }}>
                    No materials found matching "{materialSearch}"
                  </div>
                )}
              </label>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <label className="form-field">
                <span>Quantity</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={itemForm.quantity} 
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} 
                />
              </label>
              <label className="form-field">
                <span>Unit Price *</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={itemForm.unitPrice} 
                  onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} 
                  required 
                />
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={itemSaving}>
              {itemSaving ? "Adding..." : "Add Line Item"}
            </button>
          </form>
        )}

        {quote.lineItems.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: 20 }}>No line items yet. Add items to build the quote.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Type</th>
                <th>Description</th>
                <th style={{ width: 80, textAlign: "right" }}>Qty</th>
                <th style={{ width: 120, textAlign: "right" }}>Unit Price</th>
                <th style={{ width: 120, textAlign: "right" }}>Total</th>
                {isDraft && <th style={{ width: 60 }}></th>}
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={`status-badge ${
                      item.itemType === "LABOR" ? "blue" : 
                      item.itemType === "MATERIAL" ? "green" : 
                      "gray"
                    }`}>
                      {item.itemType}
                    </span>
                  </td>
                  <td>{item.description}</td>
                  <td style={{ textAlign: "right" }}>{Number(item.quantity)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(Number(item.unitPrice))}</td>
                  <td style={{ textAlign: "right", fontWeight: 500 }}>{formatCurrency(Number(item.totalPrice))}</td>
                  {isDraft && (
                    <td>
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => handleDeleteLineItem(item.id)}
                        style={{ padding: "4px 8px", fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={isDraft ? 4 : 4} style={{ textAlign: "right", borderTop: "2px solid var(--border)" }}>
                  <strong>Subtotal:</strong>
                </td>
                <td style={{ textAlign: "right", fontWeight: 500, borderTop: "2px solid var(--border)" }}>
                  {formatCurrency(Number(quote.subtotal))}
                </td>
                {isDraft && <td style={{ borderTop: "2px solid var(--border)" }}></td>}
              </tr>
              <tr>
                <td colSpan={isDraft ? 4 : 4} style={{ textAlign: "right" }}>
                  <strong>Total:</strong>
                </td>
                <td style={{ textAlign: "right", fontSize: "1.2em", fontWeight: 600, color: "var(--primary)" }}>
                  {formatCurrency(Number(quote.total))}
                </td>
                {isDraft && <td></td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Notes & Terms */}
      {(quote.notes || quote.terms) && (
        <div className="card">
          <div className="card-header">
            <h3>Additional Information</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: quote.notes && quote.terms ? "1fr 1fr" : "1fr", gap: 20 }}>
            {quote.notes && (
              <div>
                <h4 style={{ marginBottom: 8, fontSize: 14, color: "var(--text-muted)" }}>Internal Notes</h4>
                <p style={{ whiteSpace: "pre-wrap" }}>{quote.notes}</p>
              </div>
            )}
            {quote.terms && (
              <div>
                <h4 style={{ marginBottom: 8, fontSize: 14, color: "var(--text-muted)" }}>Terms & Conditions</h4>
                <p style={{ whiteSpace: "pre-wrap" }}>{quote.terms}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showApproveModal && (
        <div className="modal-backdrop" onClick={() => setShowApproveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mark Quote Approved</h3>
            <label className="form-field">
              <span>Approved By (optional)</span>
              <input 
                type="text" 
                value={approverName} 
                onChange={(e) => setApproverName(e.target.value)} 
                placeholder="Customer name" 
              />
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-success" 
                onClick={() => handleAction("approve", { approvedByName: approverName })} 
                disabled={actionLoading}
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mark Quote Rejected</h3>
            <label className="form-field">
              <span>Reason (optional)</span>
              <textarea 
                value={rejectReason} 
                onChange={(e) => setRejectReason(e.target.value)} 
                placeholder="Why was the quote rejected?" 
                rows={3} 
              />
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => handleAction("reject", { rejectionReason: rejectReason })} 
                disabled={actionLoading}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {showConvertModal && (
        <div className="modal-backdrop" onClick={() => setShowConvertModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Convert to Order</h3>
            <p style={{ marginBottom: 16, color: "var(--text-muted)" }}>
              This will create a new {convertOrderType.replace("_", " ").toLowerCase()} based on this quote.
            </p>
            <label className="form-field">
              <span>Order Type</span>
              <select value={convertOrderType} onChange={(e) => setConvertOrderType(e.target.value)}>
                <option value="WORK_ORDER">Work Order (WO)</option>
                <option value="SALES_ORDER">Sales Order (SO)</option>
                <option value="PROJECT">Project (PJ)</option>
              </select>
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleAction("convert", { orderType: convertOrderType })} 
                disabled={actionLoading}
              >
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
