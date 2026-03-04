"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Customer, Site } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import "./sites.css";


type ListResponse<T> = {
  data?: T[];
};

type SiteFormState = {
  customerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  accessNotes: string;
};

const createInitialState = (): SiteFormState => ({
  customerId: "",
  name: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  accessNotes: "",
});

async function fetchList<T>(path: string): Promise<T[]> {
  const response = await apiFetch(path, { cache: "no-store" });
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const payload = (await response.json()) as { error?: string };
      detail = payload.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail ?? `Request to ${path} failed with ${response.status}`);
  }

  const payload = (await response.json()) as ListResponse<T>;
  return payload.data ?? [];
}

export default function SitesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState<SiteFormState>(() => createInitialState());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Pagination and search
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const customerLookup = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((customer) => map.set(customer.id, customer));
    return map;
  }, [customers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customerData, siteData] = await Promise.all([
        fetchList<Customer>("/api/customers"),
        fetchList<Site>("/api/sites"),
      ]);
      setCustomers(customerData);

      // Remove duplicates based on site ID
      const uniqueSites = Array.from(
        new Map(siteData.map(site => [site.id, site])).values()
      );
      setSites(uniqueSites);

      console.log('Sites loaded:', siteData.length, 'Unique:', uniqueSites.length);
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to load site data. Please refresh."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const canSubmit = form.customerId.trim() && form.name.trim();

  const handleFieldChange = (field: keyof SiteFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const refreshSites = async () => {
    try {
      const siteData = await fetchList<Site>("/api/sites");

      // Remove duplicates based on site ID
      const uniqueSites = Array.from(
        new Map(siteData.map(site => [site.id, site])).values()
      );
      setSites(uniqueSites);

      console.log('Sites refreshed:', siteData.length, 'Unique:', uniqueSites.length);
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to refresh sites. Please try again."
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!canSubmit) {
      setSubmitError("Customer and name are required.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerId: form.customerId,
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        accessNotes: form.accessNotes.trim() || null,
      };

      const response = await apiFetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const errorPayload = (await response.json()) as { error?: string };
          detail = errorPayload.error;
        } catch {
          // ignore parse errors
        }
        throw new Error(detail ?? "Failed to create site.");
      }

      setForm(createInitialState());
      setSubmitSuccess("Site created.");
      await refreshSites();
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Failed to create site.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderLocation = (site: Site) => {
    if (site.city || site.state) {
      return [site.city, site.state].filter(Boolean).join(", ");
    }
    return "—";
  };

  // Filter and paginate sites
  const filteredSites = sites.filter((site) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const customer = customerLookup.get(site.customerId);
    return (
      site.name.toLowerCase().includes(search) ||
      customer?.name.toLowerCase().includes(search) ||
      site.city?.toLowerCase().includes(search) ||
      site.state?.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSites = filteredSites.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate stats
  const totalSites = sites.length;
  const uniqueCustomers = new Set(sites.map(s => s.customerId)).size;
  const uniqueLocations = new Set(sites.filter(s => s.city).map(s => s.city)).size;

  return (
    <div className="sites-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Sites</h1>
          <p className="page-subtitle">
            Track facilities, addresses, and service coverage
          </p>
        </div>
        <div className="page-header-right">
          <span className="btn-secondary">Org scoped</span>
        </div>
      </div>

      {/* Error Alert */}
      {loadError && <div className="alert-error">Failed to load sites: {loadError}. Refresh the page or try again.</div>}
      {submitSuccess && <div className="alert-success">{submitSuccess}</div>}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon sites">📍</div>
          <div className="stat-content">
            <h3>{totalSites}</h3>
            <p>Total Sites</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon customers">🏢</div>
          <div className="stat-content">
            <h3>{uniqueCustomers}</h3>
            <p>Customers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon locations">🌍</div>
          <div className="stat-content">
            <h3>{uniqueLocations}</h3>
            <p>Locations</p>
          </div>
        </div>
      </div>

      {/* Create Site Form */}
      <div className="create-card">
        <div className="create-card-header">
          <h2>+ Create Site</h2>
        </div>
        <div className="create-card-body">
          <form className="create-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="field-label">Customer *</label>
              <select
                value={form.customerId}
                onChange={(event) => handleFieldChange("customerId", event.target.value)}
                disabled={loading || submitting || customers.length === 0}
                className="field-select"
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Site name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleFieldChange("name", event.target.value)}
                placeholder="Facility name"
                disabled={loading || submitting}
                className="field-input"
                required
              />
            </div>

            <div className="form-field">
              <label className="field-label">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(event) => handleFieldChange("address", event.target.value)}
                placeholder="123 Main St"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(event) => handleFieldChange("city", event.target.value)}
                placeholder="City"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">State / Province</label>
              <input
                type="text"
                value={form.state}
                onChange={(event) => handleFieldChange("state", event.target.value)}
                placeholder="State or province"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Postal code</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(event) => handleFieldChange("postalCode", event.target.value)}
                placeholder="Postal code"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(event) => handleFieldChange("country", event.target.value)}
                placeholder="Country"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field full-width">
              <label className="field-label">Access notes</label>
              <textarea
                rows={3}
                value={form.accessNotes}
                onChange={(event) => handleFieldChange("accessNotes", event.target.value)}
                placeholder="Gate codes, onsite contact, parking instructions..."
                disabled={loading || submitting}
                className="field-textarea"
              />
            </div>

            {submitError && <div className="alert-error">{submitError}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={!canSubmit || submitting}>
                {submitting ? "Saving..." : "Create site"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sites Table */}
      <div className="sites-table-card">
        <div className="sites-table-header">
          <h2>Sites ({sites.length} total)</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={refreshSites}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {!loading && sites.length > 0 && (
          <div className="sites-search-bar">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search sites by name, customer, city, or state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="search-results-count">
              Showing {paginatedSites.length} of {filteredSites.length} sites
              {searchTerm && ` (filtered from ${sites.length} total)`}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span>Loading sites...</span>
          </div>
        ) : sites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📍</div>
            <h3>No sites yet</h3>
            <p>Create one using the form above</p>
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No sites match your search</h3>
            <p>Try adjusting your search term</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Customer</th>
                  <th>City / State</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSites.map((site) => (
                  <tr key={site.id}>
                    <td><Link href={`/sites/${site.id}`}>{site.name}</Link></td>
                    <td>{customerLookup.get(site.customerId)?.name ?? "—"}</td>
                    <td>{renderLocation(site)}</td>
                    <td>{new Date(site.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
