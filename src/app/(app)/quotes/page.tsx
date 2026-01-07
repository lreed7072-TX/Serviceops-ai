"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";

type Customer = { id: string; name: string };
type Site = { id: string; name: string; customerId: string };
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
  _count: { lineItems: number };
};

const statusColors: Record<string, string> = {
  DRAFT: "gray",
  SENT: "blue",
  APPROVED: "green",
  REJECTED: "red",
  EXPIRED: "orange",
  CONVERTED: "purple",
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ customerId: "", siteId: "", title: "", description: "", validUntil: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [qRes, cRes, sRes] = await Promise.all([
        apiFetch("/api/quotes", { cache: "no-store" }),
        apiFetch("/api/customers", { cache: "no-store" }),
        apiFetch("/api/sites", { cache: "no-store" }),
      ]);
      if (qRes.ok) setQuotes((await qRes.json()).data ?? []);
      if (cRes.ok) setCustomers((await cRes.json()).data ?? []);
      if (sRes.ok) setSites((await sRes.json()).data ?? []);
    } catch (e: any) {
      setError(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredSites = formData.customerId
    ? sites.filter((s) => s.customerId === formData.customerId)
    : sites;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.title.trim()) {
      setFormError("Customer and title are required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await apiFetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          siteId: formData.siteId || null,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          validUntil: formData.validUntil || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create quote");
      setShowForm(false);
      setFormData({ customerId: "", siteId: "", title: "", description: "", validUntil: "" });
      await loadData();
    } catch (e: any) {
      setFormError(e?.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <div>
      <PageHeader title="Quotes" subtitle="Create and manage customer quotes" />

      {error && <div className="page-alert error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Quotes</h3>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Quote"}
          </button>
        </div>

        {showForm && (
          <form className="quote-form" onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, background: "var(--card-muted)", borderRadius: 8 }}>
            <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
            <label className="form-field">
              <span>Title *</span>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Quote title" required />
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional details" rows={2} />
            </label>
            <label className="form-field">
              <span>Valid Until</span>
              <input type="date" value={formData.validUntil} onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} />
            </label>
            {formError && <p className="form-feedback error">{formError}</p>}
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating..." : "Create Quote"}</button>
          </form>
        )}

        {loading ? (
          <p>Loading quotes...</p>
        ) : quotes.length === 0 ? (
          <p className="muted">No quotes yet. Create one above.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Title</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td>{q.quoteNumber}</td>
                  <td>{q.title}</td>
                  <td>{q.customer.name}</td>
                  <td><span className={`status-badge ${statusColors[q.status]}`}>{q.status}</span></td>
                  <td>{q._count.lineItems}</td>
                  <td>{formatCurrency(Number(q.total))}</td>
                  <td>{formatDate(q.createdAt)}</td>
                  <td><Link href={`/quotes/${q.id}`} className="link-button">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
