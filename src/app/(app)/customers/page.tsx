"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import "./customers.css";

type Customer = {
  id: string;
  name: string;
  status: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  notes: string | null;
  _count?: {
    sites: number;
    workOrders: number;
  };
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create Customer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function loadCustomers() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/customers");
      if (!res.ok) {
        throw new Error(`Failed to load customers (${res.status})`);
      }
      const json = await res.json();
      setCustomers(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load customers.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      status: "ACTIVE",
      primaryEmail: "",
      primaryPhone: "",
      billingStreet1: "",
      billingStreet2: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      notes: "",
    });
  };

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !formData.name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await apiFetch("/api/customers", {
        method: "POST",
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
        throw new Error(data.error || `Create failed (${res.status})`);
      }

      setIsModalOpen(false);
      resetForm();
      await loadCustomers();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create customer.");
    } finally {
      setSaving(false);
    }
  }

  // Filter customers based on search and status
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      searchTerm === "" ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.primaryEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.primaryPhone?.includes(searchTerm);

    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === "ACTIVE").length;
  const totalSites = customers.reduce((sum, c) => sum + (c._count?.sites || 0), 0);
  const totalWorkOrders = customers.reduce((sum, c) => sum + (c._count?.workOrders || 0), 0);

  return (
    <div className="customers-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Customers</h1>
          <p className="page-subtitle">
            Manage client accounts, sites, and service history
          </p>
        </div>
        <div className="page-header-right">
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            + New Customer
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && <div className="alert-error">{error}</div>}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon customers">🏢</div>
          <div className="stat-content">
            <h3>{totalCustomers}</h3>
            <p>Total Customers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">✓</div>
          <div className="stat-content">
            <h3>{activeCustomers}</h3>
            <p>Active</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon sites">📍</div>
          <div className="stat-content">
            <h3>{totalSites}</h3>
            <p>Total Sites</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon workorders">🔧</div>
          <div className="stat-content">
            <h3>{totalWorkOrders}</h3>
            <p>Work Orders</p>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="search-filter-section">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-buttons">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`filter-btn ${statusFilter === "ALL" ? "active" : ""}`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`filter-btn ${statusFilter === "ACTIVE" ? "active" : ""}`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter("INACTIVE")}
            className={`filter-btn ${statusFilter === "INACTIVE" ? "active" : ""}`}
          >
            Inactive
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading customers...</span>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <h3>
            {searchTerm || statusFilter !== "ALL"
              ? "No customers match your search"
              : "No customers yet"}
          </h3>
          <p>
            {searchTerm || statusFilter !== "ALL"
              ? "Try adjusting your filters or search term"
              : "Create your first customer to get started"}
          </p>
          {!searchTerm && statusFilter === "ALL" && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              + Create Customer
            </button>
          )}
        </div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="customer-card"
            >
              <div className="customer-card-header">
                <h3 className="customer-name">{customer.name}</h3>
                <span
                  className={`status-badge ${customer.status?.toLowerCase() || "active"}`}
                >
                  {customer.status || "Active"}
                </span>
              </div>

              <div className="customer-details">
                {customer.primaryEmail && (
                  <div className="customer-detail-row">
                    <span className="icon">📧</span>
                    <span>{customer.primaryEmail}</span>
                  </div>
                )}
                {customer.primaryPhone && (
                  <div className="customer-detail-row">
                    <span className="icon">📞</span>
                    <span>{customer.primaryPhone}</span>
                  </div>
                )}
                {!customer.primaryEmail && !customer.primaryPhone && (
                  <div className="customer-detail-row">
                    <span style={{ color: "#9ca3af" }}>No contact info</span>
                  </div>
                )}
              </div>

              <div className="customer-stats">
                <div className="customer-stat">
                  <span className="customer-stat-value">
                    {customer._count?.sites || 0}
                  </span>
                  <span className="customer-stat-label">Sites</span>
                </div>
                <div className="customer-stat">
                  <span className="customer-stat-value">
                    {customer._count?.workOrders || 0}
                  </span>
                  <span className="customer-stat-label">Work Orders</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Customer Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Customer</h3>
              <button
                onClick={() => !saving && setIsModalOpen(false)}
                className="modal-close"
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g. Acme Corporation"
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
                      onChange={(e) =>
                        setFormData({ ...formData, primaryEmail: e.target.value })
                      }
                      placeholder="billing@example.com"
                      className="field-input"
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">Phone</label>
                    <input
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, primaryPhone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="field-label">Street Address</label>
                  <input
                    type="text"
                    value={formData.billingStreet1}
                    onChange={(e) =>
                      setFormData({ ...formData, billingStreet1: e.target.value })
                    }
                    placeholder="123 Main Street"
                    className="field-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="field-label">City</label>
                    <input
                      type="text"
                      value={formData.billingCity}
                      onChange={(e) =>
                        setFormData({ ...formData, billingCity: e.target.value })
                      }
                      placeholder="City"
                      className="field-input"
                    />
                  </div>
                  <div className="form-field">
                    <label className="field-label">State</label>
                    <input
                      type="text"
                      value={formData.billingState}
                      onChange={(e) =>
                        setFormData({ ...formData, billingState: e.target.value })
                      }
                      placeholder="State"
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label className="field-label">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.billingPostalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, billingPostalCode: e.target.value })
                    }
                    placeholder="12345"
                    className="field-input"
                    style={{ maxWidth: "150px" }}
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Additional notes about this customer..."
                    className="field-textarea"
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="btn-cancel"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={saving || !formData.name.trim()}
                >
                  {saving ? "Creating..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
