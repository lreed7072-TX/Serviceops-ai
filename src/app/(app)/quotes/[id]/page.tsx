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
const statusColors: Record<string, string> = { DRAFT: "gray", SENT: "blue", APPROVED: "green", REJECTED: "red", EXPIRED: "orange", CONVERTED: "purple" };

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
  const [itemForm, setItemForm] = useState({ itemType: "LABOR", description: "", quantity: "1", unitPrice: "", materialId: "" });
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
    }
  };

  // Auto-fill from material
  const handleMaterialSelect = (materialId: string) => {
    const mat = materials.find((m) => m.id === materialId);
    if (mat) {
      setItemForm({
        ...itemForm,
        materialId,
        description: mat.name + (mat.partNumber ? ` (${mat.partNumber})` : ""),
        unitPrice: mat.unitCost?.toString() || itemForm.unitPrice,
        itemType: "MATERIAL",
      });
    } else {
      setItemForm({ ...itemForm, materialId: "" });
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
        {quote.description && <p>{quote.description}</p>}
        <div className="quote-meta" style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
          <span><strong>Created:</strong> {formatDate(quote.createdAt)}</span>
          {quote.validUntil && <span><strong>Valid Until:</strong> {formatDate(quote.validUntil)}</span>}
          {quote.sentAt && <span><strong>Sent:</strong> {formatDate(quote.sentAt)}</span>}
          {quote.approvedAt && <span><strong>Approved:</strong> {formatDate(quote.approvedAt)} {quote.approvedByName && `by ${quote.approvedByName}`}</span>}
          {quote.rejectedAt && <span><strong>Rejected:</strong> {formatDate(quote.rejectedAt)}</span>}
        </div>

        {/* Actions */}
        <div className="quote-actions" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isDraft && <button className="btn btn-primary" onClick={() => handleAction("send")} disabled={actionLoading || quote.lineItems.length === 0}>Send to Customer</button>}
          {isSent && <button className="btn btn-success" onClick={() => setShowApproveModal(true)} disabled={actionLoading}>Mark Approved</button>}
          {isSent && <button className="btn btn-danger" onClick={() => setShowRejectModal(true)} disabled={actionLoading}>Mark Rejected</button>}
          {isSent && <button className="btn btn-secondary" onClick={() => handleAction("revert_to_draft")} disabled={actionLoading}>Revert to Draft</button>}
          {isApproved && <button className="btn btn-primary" onClick={() => setShowConvertModal(true)} disabled={actionLoading}>Convert to Order</button>}
          {quote.convertedToOrderId && <Link href={`/work-orders/${quote.convertedToOrderId}`} className="btn btn-outline">View {quote.convertedToOrderType?.replace("_", " ")}</Link>}
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="card-header">
          <h3>Line Items</h3>
          {isDraft && <button className="btn btn-outline" onClick={() => setShowAddItem(!showAddItem)}>{showAddItem ? "Cancel" : "+ Add Item"}</button>}
        </div>

        {showAddItem && (
          <form onSubmit={handleAddLineItem} style={{ marginBottom: 16, padding: 16, background: "var(--card-muted)", borderRadius: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="form-field">
                <span>Type</span>
                <select value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>From Catalog (optional)</span>
                <select value={itemForm.materialId} onChange={(e) => handleMaterialSelect(e.target.value)}>
                  <option value="">Manual entry</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}{m.partNumber ? ` (${m.partNumber})` : ""}</option>)}
                </select>
              </label>
            </div>
            <label className="form-field">
              <span>Description *</span>
              <input type="text" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} required />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="form-field">
                <span>Quantity</span>
                <input type="number" step="0.01" min="0" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} />
              </label>
              <label className="form-field">
                <span>Unit Price *</span>
                <input type="number" step="0.01" min="0" value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} required />
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={itemSaving}>{itemSaving ? "Adding..." : "Add Line Item"}</button>
          </form>
        )}

        {quote.lineItems.length === 0 ? (
          <p className="muted">No line items yet. Add items to build the quote.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Unit Price</th>
                <th style={{ textAlign: "right" }}>Total</th>
                {isDraft && <th></th>}
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((item) => (
                <tr key={item.id}>
                  <td><span className={`item-type-badge ${item.itemType.toLowerCase()}`}>{item.itemType}</span></td>
                  <td>{item.description}</td>
                  <td style={{ textAlign: "right" }}>{Number(item.quantity)}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(Number(item.unitPrice))}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(Number(item.totalPrice))}</td>
                  {isDraft && <td><button className="btn-icon danger" onClick={() => handleDeleteLineItem(item.id)}>🗑️</button></td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={isDraft ? 4 : 4} style={{ textAlign: "right" }}><strong>Subtotal:</strong></td>
                <td style={{ textAlign: "right" }}><strong>{formatCurrency(Number(quote.subtotal))}</strong></td>
                {isDraft && <td></td>}
              </tr>
              <tr>
                <td colSpan={isDraft ? 4 : 4} style={{ textAlign: "right" }}><strong>Total:</strong></td>
                <td style={{ textAlign: "right" }}><strong style={{ fontSize: "1.2em" }}>{formatCurrency(Number(quote.total))}</strong></td>
                {isDraft && <td></td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Modals */}
      {showApproveModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Mark Quote Approved</h3>
            <label className="form-field">
              <span>Approved By (optional)</span>
              <input type="text" value={approverName} onChange={(e) => setApproverName(e.target.value)} placeholder="Customer name" />
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={() => handleAction("approve", { approvedByName: approverName })} disabled={actionLoading}>Confirm Approval</button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Mark Quote Rejected</h3>
            <label className="form-field">
              <span>Reason (optional)</span>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why was the quote rejected?" rows={3} />
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleAction("reject", { rejectionReason: rejectReason })} disabled={actionLoading}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {showConvertModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Convert to Order</h3>
            <label className="form-field">
              <span>Order Type</span>
              <select value={convertOrderType} onChange={(e) => setConvertOrderType(e.target.value)}>
                <option value="WORK_ORDER">Work Order (WO)</option>
                <option value="SALES_ORDER">Sales Order (SO)</option>
                <option value="PROJECT">Project (PJ)</option>
              </select>
            </label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleAction("convert", { orderType: convertOrderType })} disabled={actionLoading}>Create Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
