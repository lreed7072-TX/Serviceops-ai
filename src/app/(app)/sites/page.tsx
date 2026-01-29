"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Customer, Site } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";


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

  return (
    <div>
      {loadError && (
        <div className="page-alert error">
          Failed to load sites: {loadError}. Refresh the page or try again.
        </div>
      )}
      {!loadError && loading && (
        <div className="page-alert info">Loading customer and site data…</div>
      )}

            <PageHeader
        title="Sites"
        subtitle="Track facilities, addresses, and service coverage."
        right={
          <>
            <Badge>Org scoped</Badge>
          </>
        }
      />

      <div className="card">
        <h3>Create site</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Customer</span>
            <select
              value={form.customerId}
              onChange={(event) => handleFieldChange("customerId", event.target.value)}
              disabled={loading || submitting || customers.length === 0}
              required
            >
              <option value="">Select a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Site name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleFieldChange("name", event.target.value)}
              placeholder="Facility name"
              disabled={loading || submitting}
              required
            />
          </label>

          <label className="form-field">
            <span>Address</span>
            <input
              type="text"
              value={form.address}
              onChange={(event) => handleFieldChange("address", event.target.value)}
              placeholder="123 Main St"
              disabled={loading || submitting}
            />
          </label>

          <label className="form-field">
            <span>City</span>
            <input
              type="text"
              value={form.city}
              onChange={(event) => handleFieldChange("city", event.target.value)}
              placeholder="City"
              disabled={loading || submitting}
            />
          </label>

          <label className="form-field">
            <span>State / Province</span>
            <input
              type="text"
              value={form.state}
              onChange={(event) => handleFieldChange("state", event.target.value)}
              placeholder="State or province"
              disabled={loading || submitting}
            />
          </label>

          <label className="form-field">
            <span>Postal code</span>
            <input
              type="text"
              value={form.postalCode}
              onChange={(event) => handleFieldChange("postalCode", event.target.value)}
              placeholder="Postal code"
              disabled={loading || submitting}
            />
          </label>

          <label className="form-field">
            <span>Country</span>
            <input
              type="text"
              value={form.country}
              onChange={(event) => handleFieldChange("country", event.target.value)}
              placeholder="Country"
              disabled={loading || submitting}
            />
          </label>

          <label className="form-field">
            <span>Access notes</span>
            <textarea
              rows={3}
              value={form.accessNotes}
              onChange={(event) => handleFieldChange("accessNotes", event.target.value)}
              placeholder="Gate codes, onsite contact, parking instructions…"
              disabled={loading || submitting}
            />
          </label>

          <button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving…" : "Create site"}
          </button>

          {submitError && <p className="form-feedback error">{submitError}</p>}
          {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Sites ({sites.length} total)</h3>
          <button
            type="button"
            className="link-button"
            onClick={refreshSites}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        
        {!loading && sites.length > 0 && (
          <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)" }}>
            <input
              type="text"
              placeholder="Search sites by name, customer, city, or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 1rem",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                fontSize: "0.95rem"
              }}
            />
            <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Showing {paginatedSites.length} of {filteredSites.length} sites
              {searchTerm && ` (filtered from ${sites.length} total)`}
            </div>
          </div>
        )}
        
        {loading ? (
          <p>Loading sites…</p>
        ) : sites.length === 0 ? (
          <p>No sites yet. Create one.</p>
        ) : filteredSites.length === 0 ? (
          <p>No sites match your search.</p>
        ) : (
          <>
            <table className="table">
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
              <div style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1rem",
                borderTop: "1px solid var(--border)"
              }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: "0.5rem 1rem" }}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: "0.5rem 1rem" }}
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
