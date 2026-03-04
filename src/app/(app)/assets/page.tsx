"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Asset, Customer, Site } from "@prisma/client";
import { AssetCriticality, AssetStatus, AssetCategory, AssetFamily, AssetSubFamily } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import "./assets.css";


type ListResponse<T> = { data?: T[] };

type AssetFormState = {
  customerId: string;
  siteId: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  location: string;
  notes: string;
  status: AssetStatus;
  criticality: AssetCriticality | "";
  assetCategory: AssetCategory | "";
  assetFamily: AssetFamily | "";
  assetSubFamily: AssetSubFamily | "";
};

const createInitialState = (): AssetFormState => ({
  customerId: "",
  siteId: "",
  name: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  assetTag: "",
  location: "",
  notes: "",
  status: AssetStatus.ACTIVE,
  criticality: "",
  assetCategory: "",
  assetFamily: "",
  assetSubFamily: "",
});

const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Category -> Family mapping
const FAMILY_BY_CATEGORY: Record<AssetCategory, AssetFamily[]> = {
  [AssetCategory.ROTATING_EQUIPMENT]: [AssetFamily.PUMP, AssetFamily.MOTOR, AssetFamily.GEARBOX],
  [AssetCategory.CONTROLS_AND_ELECTRICAL]: [AssetFamily.CONTROL_PANEL, AssetFamily.ELECTRICAL_FEED_SYSTEM],
  [AssetCategory.INSTRUMENTATION]: [AssetFamily.SENSOR],
  [AssetCategory.OTHER]: [AssetFamily.OTHER],
};

// Family -> SubFamily mapping
const SUBFAMILY_BY_FAMILY: Record<AssetFamily, AssetSubFamily[]> = {
  [AssetFamily.PUMP]: [
    AssetSubFamily.SUBMERSIBLE_WASTEWATER,
    AssetSubFamily.VERTICAL_TURBINE,
    AssetSubFamily.HORIZONTAL_SPLIT_CASE,
    AssetSubFamily.END_SUCTION,
    AssetSubFamily.ANSI_API_PROCESS_PUMP,
  ],
  [AssetFamily.MOTOR]: [
    AssetSubFamily.LOW_VOLTAGE_TEFC_ODP,
    AssetSubFamily.MEDIUM_VOLTAGE,
    AssetSubFamily.EXPLOSION_PROOF,
  ],
  [AssetFamily.GEARBOX]: [
    AssetSubFamily.WORM,
    AssetSubFamily.HELICAL,
    AssetSubFamily.PLANETARY,
  ],
  [AssetFamily.CONTROL_PANEL]: [
    AssetSubFamily.UL508A_INDUSTRIAL_PANEL,
    AssetSubFamily.PUMP_CONTROL_PANEL,
    AssetSubFamily.MCC_BUCKET,
    AssetSubFamily.STARTER_VFD,
    AssetSubFamily.STARTER_SOFT_STARTER,
    AssetSubFamily.STARTER_ACROSS_THE_LINE,
  ],
  [AssetFamily.ELECTRICAL_FEED_SYSTEM]: [
    AssetSubFamily.TRANSFORMER,
    AssetSubFamily.BREAKER,
    AssetSubFamily.DISCONNECT,
    AssetSubFamily.FEEDER_SYSTEM,
  ],
  [AssetFamily.SENSOR]: [
    AssetSubFamily.LEVEL,
    AssetSubFamily.PRESSURE,
    AssetSubFamily.FLOW,
    AssetSubFamily.TEMPERATURE,
  ],
  [AssetFamily.OTHER]: [AssetSubFamily.OTHER],
};

// Helper to format enum values for display
const formatEnumValue = (value: string): string => {
  return value.split('_').map(word =>
    word.charAt(0) + word.slice(1).toLowerCase()
  ).join(' ');
};

async function fetchList<T>(path: string): Promise<T[]> {
  const response = await apiFetch(path, { cache: "no-store" });
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const payload = (await response.json()) as { error?: string };
      detail = payload.error;
    } catch {
      // ignore
    }
    throw new Error(detail ?? `Request to ${path} failed with ${response.status}`);
  }

  const payload = (await response.json()) as ListResponse<T>;
  return payload.data ?? [];
}

export default function AssetsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState<AssetFormState>(() => createInitialState());

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const customerLookup = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const siteLookup = useMemo(() => {
    const map = new Map<string, Site>();
    sites.forEach((s) => map.set(s.id, s));
    return map;
  }, [sites]);

  const filteredSites = useMemo(() => {
    if (!form.customerId) return [];
    return sites.filter((s) => s.customerId === form.customerId);
  }, [sites, form.customerId]);

  const availableFamilies = useMemo(() => {
    if (!form.assetCategory) return [];
    return FAMILY_BY_CATEGORY[form.assetCategory as AssetCategory] || [];
  }, [form.assetCategory]);

  const availableSubFamilies = useMemo(() => {
    if (!form.assetFamily) return [];
    return SUBFAMILY_BY_FAMILY[form.assetFamily as AssetFamily] || [];
  }, [form.assetFamily]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customerData, siteData, assetData] = await Promise.all([
        fetchList<Customer>("/api/customers"),
        fetchList<Site>("/api/sites"),
        fetchList<Asset>("/api/assets"),
      ]);
      setCustomers(customerData);
      setSites(siteData);
      setAssets(assetData);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : "Failed to load assets. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFieldChange = (field: keyof AssetFormState, value: any) => {
    // Reset dependent fields when category or family changes
    if (field === 'assetCategory') {
      setForm((prev) => ({ ...prev, [field]: value, assetFamily: "", assetSubFamily: "" }));
    } else if (field === 'assetFamily') {
      setForm((prev) => ({ ...prev, [field]: value, assetSubFamily: "" }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const refreshAssets = async () => {
    try {
      const assetData = await fetchList<Asset>("/api/assets");
      setAssets(assetData);
      setLoadError(null);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : "Failed to refresh assets.");
    }
  };

  const canSubmit = form.customerId.trim() && form.siteId.trim() && form.name.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!canSubmit) {
      setSubmitError("Customer, site, and asset name are required.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        customerId: form.customerId,
        siteId: form.siteId,
        name: form.name.trim(),
        manufacturer: toNullable(form.manufacturer),
        model: toNullable(form.model),
        serialNumber: toNullable(form.serialNumber),
        assetTag: toNullable(form.assetTag),
        location: toNullable(form.location),
        notes: toNullable(form.notes),
        status: form.status,
        criticality: form.criticality || null,
        assetCategory: form.assetCategory || null,
        assetFamily: form.assetFamily || null,
        assetSubFamily: form.assetSubFamily || null,
      };

      const response = await apiFetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const payload = (await response.json()) as { error?: string };
          detail = payload.error;
        } catch {
          // ignore
        }
        throw new Error(detail ?? "Failed to create asset.");
      }

      setForm(createInitialState());
      setSubmitSuccess("Asset created.");
      await refreshAssets();
    } catch (err) {
      console.error(err);
      setSubmitError(err instanceof Error ? err.message : "Failed to create asset.");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate stats
  const totalAssets = assets.length;
  const activeAssets = assets.filter(a => a.status === "ACTIVE").length;
  const criticalAssets = assets.filter(a => a.criticality === "CRITICAL" || a.criticality === "HIGH").length;
  const uniqueCategories = new Set(assets.filter(a => a.assetCategory).map(a => a.assetCategory)).size;

  return (
    <div className="assets-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Assets</h1>
          <p className="page-subtitle">
            Equipment registry with taxonomy, serials, condition, and history
          </p>
        </div>
        <div className="page-header-right">
          <span className="btn-secondary">Org scoped</span>
        </div>
      </div>

      {/* Alerts */}
      {loadError && <div className="alert-error">Failed to load assets: {loadError}. Refresh the page or try again.</div>}
      {submitSuccess && <div className="alert-success">{submitSuccess}</div>}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon assets">⚙️</div>
          <div className="stat-content">
            <h3>{totalAssets}</h3>
            <p>Total Assets</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">✓</div>
          <div className="stat-content">
            <h3>{activeAssets}</h3>
            <p>Active</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon critical">⚠️</div>
          <div className="stat-content">
            <h3>{criticalAssets}</h3>
            <p>High / Critical</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon categories">📂</div>
          <div className="stat-content">
            <h3>{uniqueCategories}</h3>
            <p>Categories</p>
          </div>
        </div>
      </div>

      {/* Create Asset Form */}
      <div className="create-card">
        <div className="create-card-header">
          <h2>+ Create Asset</h2>
        </div>
        <div className="create-card-body">
          <form className="create-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="field-label">Customer *</label>
              <select
                value={form.customerId}
                onChange={(e) => {
                  const nextCustomerId = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    customerId: nextCustomerId,
                    siteId: "",
                  }));
                }}
                disabled={loading || submitting || customers.length === 0}
                className="field-select"
                required
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Site *</label>
              <select
                value={form.siteId}
                onChange={(e) => handleFieldChange("siteId", e.target.value)}
                disabled={loading || submitting || !form.customerId}
                className="field-select"
                required
              >
                <option value="">Select a site</option>
                {filteredSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Asset name *</label>
              <input
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="Pump 1A"
                disabled={loading || submitting}
                className="field-input"
                required
              />
            </div>

            {/* Asset Taxonomy */}
            <div className="form-field">
              <label className="field-label">Asset Category</label>
              <select
                value={form.assetCategory}
                onChange={(e) => handleFieldChange("assetCategory", e.target.value)}
                disabled={loading || submitting}
                className="field-select"
              >
                <option value="">--</option>
                {Object.values(AssetCategory).map((v) => (
                  <option key={v} value={v}>
                    {formatEnumValue(v)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Asset Family</label>
              <select
                value={form.assetFamily}
                onChange={(e) => handleFieldChange("assetFamily", e.target.value)}
                disabled={loading || submitting || !form.assetCategory}
                className="field-select"
              >
                <option value="">--</option>
                {availableFamilies.map((v) => (
                  <option key={v} value={v}>
                    {formatEnumValue(v)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Asset Sub-Family</label>
              <select
                value={form.assetSubFamily}
                onChange={(e) => handleFieldChange("assetSubFamily", e.target.value)}
                disabled={loading || submitting || !form.assetFamily}
                className="field-select"
              >
                <option value="">--</option>
                {availableSubFamilies.map((v) => (
                  <option key={v} value={v}>
                    {formatEnumValue(v)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Manufacturer</label>
              <input
                value={form.manufacturer}
                onChange={(e) => handleFieldChange("manufacturer", e.target.value)}
                placeholder="Optional"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Model</label>
              <input
                value={form.model}
                onChange={(e) => handleFieldChange("model", e.target.value)}
                placeholder="Optional"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Serial number</label>
              <input
                value={form.serialNumber}
                onChange={(e) => handleFieldChange("serialNumber", e.target.value)}
                placeholder="Optional"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Asset tag</label>
              <input
                value={form.assetTag}
                onChange={(e) => handleFieldChange("assetTag", e.target.value)}
                placeholder="Optional"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Location</label>
              <input
                value={form.location}
                onChange={(e) => handleFieldChange("location", e.target.value)}
                placeholder="Optional"
                disabled={loading || submitting}
                className="field-input"
              />
            </div>

            <div className="form-field">
              <label className="field-label">Status</label>
              <select
                value={form.status}
                onChange={(e) => handleFieldChange("status", e.target.value as AssetStatus)}
                disabled={loading || submitting}
                className="field-select"
              >
                {Object.values(AssetStatus).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="field-label">Criticality</label>
              <select
                value={form.criticality}
                onChange={(e) => handleFieldChange("criticality", e.target.value as any)}
                disabled={loading || submitting}
                className="field-select"
              >
                <option value="">--</option>
                {Object.values(AssetCriticality).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field full-width">
              <label className="field-label">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                placeholder="Optional"
                rows={3}
                disabled={loading || submitting}
                className="field-textarea"
              />
            </div>

            {submitError && <div className="alert-error">{submitError}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={!canSubmit || submitting}>
                {submitting ? "Creating..." : "Create asset"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Assets Table */}
      <div className="assets-table-card">
        <div className="assets-table-header">
          <h2>Existing assets</h2>
          <button type="button" className="btn-secondary" onClick={refreshAssets} disabled={loading}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span>Loading assets...</span>
          </div>
        ) : assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚙️</div>
            <h3>No assets yet</h3>
            <p>Create one using the form above</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Family</th>
                <th>Customer</th>
                <th>Site</th>
                <th>Status</th>
                <th>Criticality</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/assets/${a.id}`}>{a.name}</Link>
                  </td>
                  <td>{a.assetCategory ? formatEnumValue(a.assetCategory) : "—"}</td>
                  <td>{a.assetFamily ? formatEnumValue(a.assetFamily) : "—"}</td>
                  <td>{customerLookup.get(a.customerId)?.name ?? "—"}</td>
                  <td>{siteLookup.get(a.siteId)?.name ?? "—"}</td>
                  <td>
                    <span className={`status-badge ${a.status?.toLowerCase() || "active"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    {a.criticality ? (
                      <span className={`criticality-badge ${a.criticality?.toLowerCase()}`}>
                        {a.criticality}
                      </span>
                    ) : "—"}
                  </td>
                  <td>{new Date(a.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
