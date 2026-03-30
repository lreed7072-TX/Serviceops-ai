"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Customer, Site } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import "./site-detail.css";

type SingleResponse<T> = { data: T };
type ListResponse<T> = { data?: T[] };

type SiteContact = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  isDecisionMaker: boolean;
  isTechnicalInfluencer: boolean;
  isGatekeeper: boolean;
  isPrimary: boolean;
};

export default function SiteDetailPage() {
  const params = useParams();
  const siteId = params?.id as string | undefined;

  const [site, setSite] = useState<Site | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<SiteContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");

  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        const siteRes = await apiFetch(`/api/sites/${siteId}`, { cache: "no-store" });
        if (!siteRes.ok) {
          const payload = (await siteRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load site.");
        }
        const sitePayload = (await siteRes.json()) as SingleResponse<Site>;

        const customersRes = await apiFetch(`/api/customers`);
        if (!customersRes.ok) {
          const payload = (await customersRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load customers.");
        }
        const customersPayload = (await customersRes.json()) as ListResponse<Customer>;
        const foundCustomer =
          (customersPayload.data ?? []).find((c) => c.id === sitePayload.data.customerId) ?? null;

        // Load contacts for this site
        const contactsRes = await apiFetch(`/api/contacts?siteId=${siteId}`, { cache: "no-store" });
        const contactsData = contactsRes.ok ? await contactsRes.json() : { data: [] };

        if (cancelled) return;

        setSite(sitePayload.data);
        setEditName(sitePayload.data.name ?? "");
        setEditAddress(sitePayload.data.address ?? "");
        setEditCity(sitePayload.data.city ?? "");
        setEditState(sitePayload.data.state ?? "");
        setEditPostalCode(sitePayload.data.postalCode ?? "");
        setCustomer(foundCustomer);
        setContacts(contactsData.data ?? []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load site.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const addr = site
    ? [site.address, site.city, site.state, site.postalCode, site.country].filter(Boolean).join(", ")
    : "—";


  async function saveSite(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    if (saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await apiFetch(`/api/sites/${siteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
          state: editState.trim() || null,
          postalCode: editPostalCode.trim() || null,
          country: "US",
        }),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? `Save failed (${res.status})`);
      }

      const payload = (await res.json()) as { data: Site };
      setSite(payload.data);
      // keep form in sync
      setEditName(payload.data.name ?? "");
      setEditAddress(payload.data.address ?? "");
      setEditCity(payload.data.city ?? "");
      setEditState(payload.data.state ?? "");
      setEditPostalCode(payload.data.postalCode ?? "");
      setShowEdit(false);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save site.");
    } finally {
      setSaving(false);
    }
  }

  if (!siteId) {
    return (
      <div className="site-detail-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Missing site ID</h2>
          <p>No site ID was found in the URL.</p>
          <Link href="/sites" className="btn-primary">Back to Sites</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="site-detail-page">
      {/* Breadcrumb */}
      <Breadcrumbs items={[
        { label: "Sites", href: "/sites" },
        { label: site?.name ?? "Site" },
      ]} />

      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>{site?.name ?? "Site"}</h1>
            <p className="header-subtitle">Facility profile and location details</p>
          </div>
          <div className="header-right">
            {site && (
              <button type="button" className="btn-primary" onClick={() => setShowEdit(true)}>
                Edit Site
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="alert-error">{error}</div>}
      {loading && !error && <div className="alert-info">Loading site...</div>}

      {/* Attachments */}
      <AttachmentsPanel entityType="site" entityId={siteId as string} />

      {/* Site Details */}
      {site && (
        <div className="detail-card">
          <div className="card-header">
            <h2>Site Information</h2>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Customer</span>
                <span className="info-value">{customer?.name ?? "—"}</span>
              </div>

              <div className="info-item full-width">
                <span className="info-label">Address</span>
                <span className="info-value">{addr || "—"}</span>
              </div>

              <div className="info-item">
                <span className="info-label">City</span>
                <span className="info-value">{site.city ?? "—"}</span>
              </div>

              <div className="info-item">
                <span className="info-label">State</span>
                <span className="info-value">{site.state ?? "—"}</span>
              </div>

              <div className="info-item">
                <span className="info-label">ZIP</span>
                <span className="info-value">{site.postalCode ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Site Contacts */}
      <div className="detail-card" style={{ marginTop: "1.5rem" }}>
        <div className="card-header">
          <h2>Site Contacts</h2>
        </div>
        <div className="card-body">
          {contacts.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "0.875rem", padding: "0.5rem 0" }}>
              No contacts assigned to this site.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
              {contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "0.875rem",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        {c.firstName} {c.lastName}
                      </div>
                      {c.title && (
                        <div style={{ fontSize: "0.8125rem", color: "#6b7280" }}>{c.title}</div>
                      )}
                    </div>
                    {c.isPrimary && (
                      <span style={{
                        fontSize: "0.6875rem",
                        padding: "0.125rem 0.5rem",
                        borderRadius: 9999,
                        background: "#dbeafe",
                        color: "#1e40af",
                        fontWeight: 600,
                      }}>
                        Primary
                      </span>
                    )}
                  </div>
                  {c.email && (
                    <div style={{ fontSize: "0.8125rem", color: "#374151", marginTop: "0.375rem" }}>
                      {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div style={{ fontSize: "0.8125rem", color: "#374151" }}>
                      {c.phone}
                    </div>
                  )}
                  {(c.isDecisionMaker || c.isTechnicalInfluencer || c.isGatekeeper) && (
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                      {c.isDecisionMaker && (
                        <span style={{ fontSize: "0.6875rem", padding: "0.125rem 0.375rem", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>
                          Decision Maker
                        </span>
                      )}
                      {c.isTechnicalInfluencer && (
                        <span style={{ fontSize: "0.6875rem", padding: "0.125rem 0.375rem", borderRadius: 4, background: "#e0e7ff", color: "#3730a3" }}>
                          Technical
                        </span>
                      )}
                      {c.isGatekeeper && (
                        <span style={{ fontSize: "0.6875rem", padding: "0.125rem 0.375rem", borderRadius: 4, background: "#fce7f3", color: "#9d174d" }}>
                          Gatekeeper
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && site && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowEdit(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Site</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowEdit(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveSite}>
              <div className="modal-body">
                <div className="form-field">
                  <label className="field-label">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="field-input"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Address</label>
                  <input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Street"
                    className="field-input"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">City</label>
                  <input
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="field-input"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">State</label>
                  <input
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="field-input"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">ZIP</label>
                  <input
                    value={editPostalCode}
                    onChange={(e) => setEditPostalCode(e.target.value)}
                    className="field-input"
                  />
                </div>

                {saveError && <div className="alert-error">{saveError}</div>}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowEdit(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving || !editName.trim()}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
