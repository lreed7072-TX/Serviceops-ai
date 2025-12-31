"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Customer, Site } from "@prisma/client";
import { apiFetch } from "@/lib/api";

type SingleResponse<T> = { data: T };
type ListResponse<T> = { data?: T[] };

export default function SiteDetailPage() {
  const params = useParams();
  const siteId = params?.id as string | undefined;

  const [site, setSite] = useState<Site | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
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

        const customersRes = await apiFetch(`/api/customers`, { cache: "no-store" });
        if (!customersRes.ok) {
          const payload = (await customersRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load customers.");
        }
        const customersPayload = (await customersRes.json()) as ListResponse<Customer>;
        const foundCustomer =
          (customersPayload.data ?? []).find((c) => c.id === sitePayload.data.customerId) ?? null;

        if (cancelled) return;

        setSite(sitePayload.data);
        setEditName(sitePayload.data.name ?? "");
        setEditAddress(sitePayload.data.address ?? "");
        setEditCity(sitePayload.data.city ?? "");
        setEditState(sitePayload.data.state ?? "");
        setEditPostalCode(sitePayload.data.postalCode ?? "");
        setCustomer(foundCustomer);
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
      <div className="card">
        <p>Missing site ID in URL.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Site</h2>
          <p>Facility profile and location details.</p>
        </div>
        <Link className="link-button" href="/sites">
          ← Back to list
        </Link>
      </div>

      {error && <div className="page-alert error">{error}</div>}
      {loading && !error && <div className="page-alert info">Loading site…</div>}

      {site && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{site.name}</h3>
            <button type="button" className="link-button" onClick={() => setShowEdit(true)}>
              Edit
            </button>
          </div>

          <dl className="detail-grid">
            <div>
              <dt>Customer</dt>
              <dd>{customer?.name ?? "—"}</dd>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <dt>Address</dt>
              <dd>{addr || "—"}</dd>
            </div>

            <div>
              <dt>City</dt>
              <dd>{site.city ?? "—"}</dd>
            </div>

            <div>
              <dt>State</dt>
              <dd>{site.state ?? "—"}</dd>
            </div>

            <div>
              <dt>ZIP</dt>
              <dd>{site.postalCode ?? "—"}</dd>
            </div>
          </dl>
        </div>
      )}
      {showEdit && site && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowEdit(false);
          }}
        >
          <div
            style={{
              width: "min(640px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: 16,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Edit Site</h3>
              <button type="button" className="link-button" onClick={() => setShowEdit(false)} disabled={saving}>
                Close
              </button>
            </div>

            <form onSubmit={saveSite} style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Address</span>
                <input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Street"
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>City</span>
                <input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>State</span>
                <input
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>ZIP</span>
                <input
                  value={editPostalCode}
                  onChange={(e) => setEditPostalCode(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              {saveError && (
                <div style={{ padding: 12, border: "1px solid rgba(255,0,0,0.25)", borderRadius: 10 }}>
                  <strong>Error:</strong> {saveError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="link-button" onClick={() => setShowEdit(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" disabled={saving || !editName.trim()}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
