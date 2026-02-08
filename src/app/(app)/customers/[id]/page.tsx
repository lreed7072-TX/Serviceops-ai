"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import "./customer-detail.css";

interface Customer {
  id: string;
  name: string;
  status: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  billingStreet1: string | null;
  billingStreet2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string | null;
  notes: string | null;
}

interface Site {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  customerId: string;
}

interface WorkOrder {
  id: string;
  workOrderNumber: string | null;
  title: string;
  status: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  status: string;
  total: number | string;
  createdAt: string;
}

interface Activity {
  id: string;
  type: "quote" | "work_order" | "invoice";
  title: string;
  description: string;
  amount: number | null;
  date: string;
  link: string;
  status: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string | undefined;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [woCount, setWoCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    primaryEmail: "",
    primaryPhone: "",
    billingStreet1: "",
    billingStreet2: "",
    billingCity: "",
    billingState: "",
    billingPostalCode: "",
    notes: "",
  });

  // Delete modal state
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadData();
    }
  }, [customerId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [custRes, sitesRes, woRes, invRes, actRes] = await Promise.all([
        apiFetch(`/api/customers/${customerId}`, { cache: "no-store" }),
        apiFetch(`/api/sites`, { cache: "no-store" }),
        apiFetch(`/api/work-orders?customerId=${customerId}`, { cache: "no-store" }),
        apiFetch(`/api/invoices?customerId=${customerId}`, { cache: "no-store" }),
        apiFetch(`/api/customers/${customerId}/activity`, { cache: "no-store" }),
      ]);

      if (!custRes.ok) throw new Error("Failed to load customer");

      const custData = await custRes.json();
      const sitesData = sitesRes.ok ? await sitesRes.json() : { data: [] };
      const woData = woRes.ok ? await woRes.json() : { data: [] };
      const invData = invRes.ok ? await invRes.json() : { data: [] };

      const cust = custData.data;
      setCustomer(cust);
      setSites((sitesData.data ?? []).filter((s: Site) => s.customerId === customerId));
      const allWOs = woData.data ?? [];
      const allInvoices = invData.data ?? [];
      setWoCount(allWOs.length);
      setInvoiceCount(allInvoices.length);
      setWorkOrders(allWOs.slice(0, 5));
      setInvoices(allInvoices.slice(0, 5));

      // Load activity timeline
      const actData = actRes.ok ? await actRes.json() : { data: [] };
      setActivities(actData.data ?? []);

      // Populate form
      setFormData({
        name: cust.name || "",
        status: cust.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        primaryEmail: cust.primaryEmail || "",
        primaryPhone: cust.primaryPhone || "",
        billingStreet1: cust.billingStreet1 || "",
        billingStreet2: cust.billingStreet2 || "",
        billingCity: cust.billingCity || "",
        billingState: cust.billingState || "",
        billingPostalCode: cust.billingPostalCode || "",
        notes: cust.notes || "",
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to load customer");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !formData.name.trim()) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await apiFetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          status: formData.status,
          primaryEmail: formData.primaryEmail.trim() || null,
          primaryPhone: formData.primaryPhone.trim() || null,
          billingStreet1: formData.billingStreet1.trim() || null,
          billingStreet2: formData.billingStreet2.trim() || null,
          billingCity: formData.billingCity.trim() || null,
          billingState: formData.billingState.trim() || null,
          billingPostalCode: formData.billingPostalCode.trim() || null,
          billingCountry: "US",
          notes: formData.notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      await loadData();
      setShowEdit(false);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/customers/${customerId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      router.push("/customers");
    } catch (err: any) {
      alert(err?.message ?? "Failed to delete customer");
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const getStatusClass = (status: string) => status?.toLowerCase().replace("_", "-") || "active";

  // Calculate stats
  const totalRevenue = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.total), 0);

  if (!customerId) {
    return (
      <div className="customer-detail-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Missing Customer ID</h2>
          <p>No customer ID was provided in the URL.</p>
          <Link href="/customers" className="btn-primary">
            Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="customer-detail-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading customer...</span>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="customer-detail-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Customer Not Found</h2>
          <p>{error || "The requested customer could not be found."}</p>
          <Link href="/customers" className="btn-primary">
            Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-detail-page">
      {/* Page Header */}
      <div className="page-header">
        <Link href="/customers" className="back-link">
          ← Back to Customers
        </Link>

        <div className="header-content">
          <div className="header-left">
            <h1>{customer.name}</h1>
            <span className={`customer-status ${getStatusClass(customer.status)}`}>
              {customer.status || "Active"}
            </span>
          </div>

          <div className="header-right">
            <button onClick={() => setShowEdit(true)} className="btn-secondary">
              ✏️ Edit
            </button>
            <Link href={`/work-orders/new?customerId=${customerId}`} className="btn-primary">
              + New Work Order
            </Link>
            <button onClick={() => setShowDelete(true)} className="btn-danger">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon sites">📍</div>
          <div className="stat-content">
            <h3>{sites.length}</h3>
            <p>Sites</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon workorders">🔧</div>
          <div className="stat-content">
            <h3>{woCount}</h3>
            <p>Work Orders</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon invoices">📄</div>
          <div className="stat-content">
            <h3>{invoiceCount}</h3>
            <p>Invoices</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon revenue">💰</div>
          <div className="stat-content">
            <h3>${totalRevenue.toFixed(2)}</h3>
            <p>Revenue</p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Contact Information */}
        <div className="detail-card">
          <div className="card-header">
            <h2>📇 Contact Information</h2>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">{customer.primaryEmail || "—"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phone</span>
                <span className="info-value">{customer.primaryPhone || "—"}</span>
              </div>
              <div className="info-item full-width">
                <span className="info-label">Billing Address</span>
                <span className="info-value">
                  {[
                    customer.billingStreet1,
                    customer.billingStreet2,
                    customer.billingCity,
                    customer.billingState,
                    customer.billingPostalCode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </div>
              {customer.notes && (
                <div className="info-item full-width">
                  <span className="info-label">Notes</span>
                  <span className="info-value">{customer.notes}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sites */}
        <div className="detail-card">
          <div className="card-header">
            <h2>📍 Sites</h2>
            <Link href={`/sites/new?customerId=${customerId}`} className="btn-link">
              + Add Site
            </Link>
          </div>
          <div className="card-body">
            {sites.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏢</div>
                <p>No sites yet</p>
              </div>
            ) : (
              <div className="sites-list">
                {sites.map((site) => (
                  <Link key={site.id} href={`/sites/${site.id}`} className="site-item">
                    <div className="site-icon">🏢</div>
                    <div className="site-info">
                      <h4>{site.name}</h4>
                      <p>
                        {[site.address, site.city, site.state]
                          .filter(Boolean)
                          .join(", ") || "No address"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Work Orders & Invoices Row */}
      <div className="content-grid" style={{ marginTop: "1.5rem" }}>
        {/* Recent Work Orders */}
        <div className="detail-card">
          <div className="card-header">
            <h2>🔧 Recent Work Orders</h2>
            <Link href={`/work-orders?customerId=${customerId}`} className="btn-link">
              View All
            </Link>
          </div>
          <div className="card-body">
            {workOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>No work orders yet</p>
              </div>
            ) : (
              <div className="wo-list">
                {workOrders.map((wo) => (
                  <Link key={wo.id} href={`/work-orders/${wo.id}`} className="wo-item">
                    <div className="wo-info">
                      <h4>{wo.workOrderNumber || wo.title}</h4>
                      <p>{new Date(wo.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`wo-status ${getStatusClass(wo.status)}`}>
                      {wo.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="detail-card">
          <div className="card-header">
            <h2>📄 Recent Invoices</h2>
            <Link href={`/invoices?customerId=${customerId}`} className="btn-link">
              View All
            </Link>
          </div>
          <div className="card-body">
            {invoices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <p>No invoices yet</p>
              </div>
            ) : (
              <div className="invoice-list">
                {invoices.map((inv) => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`} className="invoice-item">
                    <div className="invoice-info">
                      <h4>{inv.invoiceNumber}</h4>
                      <p>{new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className={`invoice-status ${getStatusClass(inv.status)}`}>
                        {inv.status}
                      </span>
                      <span className="invoice-amount">${Number(inv.total).toFixed(2)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      {activities.length > 0 && (
        <div className="detail-card" style={{ marginTop: "1.5rem" }}>
          <div className="card-header">
            <h2>📊 Activity History</h2>
          </div>
          <div className="card-body">
            <div className="activity-timeline">
              {activities.slice(0, 15).map((activity) => (
                <div key={activity.id} className="timeline-item">
                  <div className="timeline-dot-wrapper">
                    <div
                      className="timeline-dot"
                      style={{
                        background:
                          activity.type === "quote"
                            ? "#3b82f6"
                            : activity.type === "work_order"
                              ? "#f59e0b"
                              : "#10b981",
                      }}
                    />
                    <div className="timeline-line" />
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header-row">
                      <Link
                        href={activity.link}
                        className="timeline-title-link"
                      >
                        {activity.title}
                      </Link>
                      <span className="timeline-date">
                        {new Date(activity.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="timeline-description">{activity.description}</p>
                    {activity.amount != null && (
                      <span className="timeline-amount">
                        ${activity.amount.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => !saving && setShowEdit(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Customer</h3>
              <button onClick={() => setShowEdit(false)} className="modal-close" disabled={saving}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="field-input"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as "ACTIVE" | "INACTIVE",
                        })
                      }
                      className="field-select"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">Email</label>
                    <input
                      type="email"
                      value={formData.primaryEmail}
                      onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Phone</label>
                    <input
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="field-label">Street Address</label>
                  <input
                    type="text"
                    value={formData.billingStreet1}
                    onChange={(e) => setFormData({ ...formData, billingStreet1: e.target.value })}
                    className="field-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">City</label>
                    <input
                      type="text"
                      value={formData.billingCity}
                      onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                      className="field-input"
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">State</label>
                    <input
                      type="text"
                      value={formData.billingState}
                      onChange={(e) => setFormData({ ...formData, billingState: e.target.value })}
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="field-label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="field-textarea"
                    rows={3}
                  />
                </div>

                {saveError && (
                  <div style={{ padding: "1rem", background: "#fee2e2", borderRadius: "8px", color: "#991b1b" }}>
                    {saveError}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowEdit(false)} className="btn-cancel" disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving || !formData.name.trim()}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDelete(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Customer</h3>
              <button onClick={() => setShowDelete(false)} className="modal-close" disabled={deleting}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
                <p style={{ marginBottom: "0.5rem" }}>
                  Are you sure you want to delete <strong>{customer.name}</strong>?
                </p>
                <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  This action cannot be undone. All associated sites, work orders, and invoices will be affected.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDelete(false)} className="btn-cancel" disabled={deleting}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger"
                disabled={deleting}
                style={{ background: "#dc2626", color: "white", border: "none" }}
              >
                {deleting ? "Deleting..." : "Delete Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
