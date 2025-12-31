"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Customer, Site } from "@prisma/client";
import { apiFetch } from "@/lib/api";

type SingleResponse<T> = { data: T };
type ListResponse<T> = { data?: T[] };

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params?.id as string | undefined;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBilling, setEditBilling] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        const [custRes, sitesRes] = await Promise.all([
          apiFetch(`/api/customers/${customerId}`, { cache: "no-store" }),
          apiFetch(`/api/sites`, { cache: "no-store" }),
        ]);

        if (!custRes.ok) {
          const payload = (await custRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load customer.");
        }
        if (!sitesRes.ok) {
          const payload = (await sitesRes.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load sites.");
        }

        const custPayload = (await custRes.json()) as SingleResponse<Customer>;
        const sitesPayload = (await sitesRes.json()) as ListResponse<Site>;

        if (cancelled) return;

        setCustomer(custPayload.data);
        setSites((sitesPayload.data ?? []).filter((s) => s.customerId === customerId));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load customer.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const title = customer?.name ?? "Customer";

  const safe = (v: unknown) => {
    if (typeof v !== "string") return "—";
    const t = v.trim();
    return t.length ? t : "—";
  };

  
  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    if (saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await apiFetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          status: editStatus,
          primaryEmail: editEmail.trim() || null,
          primaryPhone: editPhone.trim() || null,
          billingAddress: editBilling.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? `Save failed (${res.status})`);
      }

      const payload = (await res.json()) as { data: Customer };
      setCustomer(payload.data);
      setShowEdit(false);
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

if (!customerId) {
    return (
      <div className="card">
        <p>Missing customer ID in URL.</p>
      {showEdit && customer && (
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
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Edit Customer</h3>
              <button type="button" className="link-button" onClick={() => setShowEdit(false)} disabled={saving}>
                Close
              </button>
            </div>

            <form onSubmit={saveCustomer} style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Primary email</span>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Primary phone</span>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Billing address</span>
                <input
                  value={editBilling}
                  onChange={(e) => setEditBilling(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Notes</span>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                  }}
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

    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Customer</h2>
          <p>Customer profile and sites.</p>
        </div>
        <Link className="link-button" href="/customers">
          ← Back to list
        </Link>
      </div>

      {error && <div className="page-alert error">{error}</div>}
      {loading && !error && <div className="page-alert info">Loading customer…</div>}

      {customer && (
        <div className="card">
          <h3>{title}</h3>

          <dl className="detail-grid">
            <div>
              <dt>Status</dt>
              <dd>{customer.status ?? "ACTIVE"}</dd>
            </div>

            <div>
              <dt>Email</dt>
              <dd>{safe((customer as any).primaryEmail)}</dd>
            </div>

            <div>
              <dt>Phone</dt>
              <dd>{safe((customer as any).primaryPhone)}</dd>
            </div>

            <div>
              <dt>Billing address</dt>
              <dd>{safe((customer as any).billingAddress)}</dd>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <dt>Notes</dt>
              <dd>{safe((customer as any).notes)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="card">
        <h3>Sites</h3>
        {loading ? (
          <p>Loading sites…</p>
        ) : sites.length === 0 ? (
          <p>No sites yet for this customer.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    {[s.address, s.city, s.state, s.postalCode, s.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
