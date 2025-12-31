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

  if (!customerId) {
    return (
      <div className="card">
        <p>Missing customer ID in URL.</p>
      </div>
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
