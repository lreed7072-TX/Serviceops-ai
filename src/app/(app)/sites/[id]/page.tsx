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
          <h3 style={{ marginTop: 0 }}>{site.name}</h3>

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
    </div>
  );
}
