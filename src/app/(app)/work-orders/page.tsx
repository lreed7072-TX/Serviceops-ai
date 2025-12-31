"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AssetCriticality, AssetStatus, ExecutionMode } from "@prisma/client";
import type { Asset, Customer, Site, WorkOrder } from "@prisma/client";
import { apiFetch } from "@/lib/api";

type ListResponse<T> = {
  data?: T[];
};

type SingleResponse<T> = {
  data: T;
};

type WorkOrderFormState = {
  title: string;
  description: string;
  customerId: string;
  siteId: string;
  assetId: string;
  executionMode: ExecutionMode;
};

type CustomerModalState = {
  name: string;
};

type SiteModalState = {
  customerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  accessNotes: string;
};

type AssetModalState = {
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
};

const executionModeLabels: Record<ExecutionMode, string> = {
  UNIFIED: "Unified",
  MULTI_LANE: "Multi-lane",
};

const executionModeOptions: ExecutionMode[] = [
  ExecutionMode.UNIFIED,
  ExecutionMode.MULTI_LANE,
];

const createInitialFormState = (): WorkOrderFormState => ({
  title: "",
  description: "",
  customerId: "",
  siteId: "",
  assetId: "",
  executionMode: ExecutionMode.UNIFIED,
});

const createCustomerModalState = (): CustomerModalState => ({
  name: "",
});

const createSiteModalState = (defaults?: Partial<SiteModalState>): SiteModalState => ({
  customerId: "",
  name: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  accessNotes: "",
  ...defaults,
});

const createAssetModalState = (defaults?: Partial<AssetModalState>): AssetModalState => ({
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
  ...defaults,
});

const formatAssetOptionLabel = (asset: Asset) => {
  const detailParts: string[] = [];
  const manufacturerModel = [asset.manufacturer, asset.model]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0))
    .join(" ");
  if (manufacturerModel) {
    detailParts.push(manufacturerModel);
  }
  const serial = asset.serialNumber?.trim();
  if (serial) {
    detailParts.push(`SN ${serial}`);
  }
  if (detailParts.length === 0) {
    return asset.name;
  }
  return `${asset.name} (${detailParts.join(" • ")})`;
};

const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export default function WorkOrdersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [form, setForm] = useState<WorkOrderFormState>(() => createInitialFormState());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalState, setCustomerModalState] = useState<CustomerModalState>(() =>
    createCustomerModalState()
  );
  const [customerModalError, setCustomerModalError] = useState<string | null>(null);
  const [customerModalSaving, setCustomerModalSaving] = useState(false);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [siteModalState, setSiteModalState] = useState<SiteModalState>(() =>
    createSiteModalState()
  );
  const [siteModalError, setSiteModalError] = useState<string | null>(null);
  const [siteModalSaving, setSiteModalSaving] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetModalState, setAssetModalState] = useState<AssetModalState>(() =>
    createAssetModalState()
  );
  const [assetModalError, setAssetModalError] = useState<string | null>(null);
  const [assetModalSaving, setAssetModalSaving] = useState(false);

  const NEW_CUSTOMER_VALUE = "__workorder_add_customer__";
  const NEW_SITE_VALUE = "__workorder_add_site__";
  const NEW_ASSET_VALUE = "__workorder_add_asset__";

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [customerData, siteData, assetData, workOrderData] = await Promise.all([
          fetchList<Customer>("/api/customers"),
          fetchList<Site>("/api/sites"),
          fetchList<Asset>("/api/assets"),
          fetchList<WorkOrder>("/api/work-orders"),
        ]);
        if (!active) return;
        setCustomers(customerData);
        setSites(siteData);
        setAssets(assetData);
        setWorkOrders(workOrderData);
        setLoadError(null);
      } catch (error) {
        if (!active) return;
        console.error(error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load work order data. Please refresh.";
        setLoadError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredSites = useMemo(() => {
    if (!form.customerId) return sites;
    return sites.filter((site) => site.customerId === form.customerId);
  }, [sites, form.customerId]);

  const filteredAssets = useMemo(() => {
    if (form.siteId) {
      return assets.filter((asset) => asset.siteId === form.siteId);
    }
    if (form.customerId) {
      return assets.filter((asset) => asset.customerId === form.customerId);
    }
    return assets;
  }, [assets, form.customerId, form.siteId]);

  const canSubmit =
    form.title.trim().length > 0 && form.customerId.length > 0 && form.siteId.length > 0;

  const refreshWorkOrders = async () => {
    try {
      const data = await fetchList<WorkOrder>("/api/work-orders");
      setWorkOrders(data);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to refresh work orders. Please try again."
      );
    }
  };

  const refreshCustomers = async (selectId?: string) => {
    try {
      const data = await fetchList<Customer>("/api/customers");
      setCustomers(data);
      if (selectId) {
        setForm((prev) => ({ ...prev, customerId: selectId, siteId: "", assetId: "" }));
      }
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to refresh customers. Please try again."
      );
    }
  };

  const refreshSites = async (selectId?: string) => {
    try {
      const data = await fetchList<Site>("/api/sites");
      setSites(data);
      if (selectId) {
        setForm((prev) => ({ ...prev, siteId: selectId, assetId: "" }));
      }
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to refresh sites. Please try again."
      );
    }
  };

  const refreshAssets = async (selectId?: string) => {
    try {
      const data = await fetchList<Asset>("/api/assets");
      setAssets(data);
      if (selectId) {
        setForm((prev) => ({ ...prev, assetId: selectId }));
      }
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError(
        error instanceof Error ? error.message : "Failed to refresh assets. Please try again."
      );
    }
  };

  const handleFieldChange = (field: keyof WorkOrderFormState, value: string) => {
    setForm((prev) => {
      if (field === "customerId") {
        return { ...prev, customerId: value, siteId: "", assetId: "" };
      }
      if (field === "siteId") {
        return { ...prev, siteId: value, assetId: "" };
      }
      if (field === "executionMode") {
        return { ...prev, executionMode: value as ExecutionMode };
      }
      return { ...prev, [field]: value };
    });
  };

  const openCustomerModal = () => {
    setCustomerModalState(createCustomerModalState());
    setCustomerModalError(null);
    setShowCustomerModal(true);
  };

  const openSiteModal = () => {
    setSiteModalState((prev) =>
      createSiteModalState({
        customerId: form.customerId || prev.customerId,
      })
    );
    setSiteModalError(null);
    setShowSiteModal(true);
  };

  const openAssetModal = () => {
    setAssetModalState((prev) =>
      createAssetModalState({
        customerId: form.customerId || prev.customerId,
        siteId: form.siteId || prev.siteId,
      })
    );
    setAssetModalError(null);
    setShowAssetModal(true);
  };

  const handleCustomerModalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomerModalError(null);
    if (!customerModalState.name.trim()) {
      setCustomerModalError("Customer name is required.");
      return;
    }

    try {
      setCustomerModalSaving(true);
      const response = await apiFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customerModalState.name.trim() }),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const payload = (await response.json()) as { error?: string };
          detail = payload.error;
        } catch {
          // ignore
        }
        throw new Error(detail ?? "Failed to create customer.");
      }

      const payload = (await response.json()) as SingleResponse<Customer>;
      setShowCustomerModal(false);
      setCustomerModalState(createCustomerModalState());
      await refreshCustomers(payload.data.id);
    } catch (error) {
      console.error(error);
      setCustomerModalError(
        error instanceof Error ? error.message : "Failed to create customer."
      );
    } finally {
      setCustomerModalSaving(false);
    }
  };

  const handleSiteModalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSiteModalError(null);
    if (!siteModalState.customerId.trim() || !siteModalState.name.trim()) {
      setSiteModalError("Customer and site name are required.");
      return;
    }

    try {
      setSiteModalSaving(true);
      const payload = {
        customerId: siteModalState.customerId,
        name: siteModalState.name.trim(),
        address: siteModalState.address.trim() || null,
        city: siteModalState.city.trim() || null,
        state: siteModalState.state.trim() || null,
        postalCode: siteModalState.postalCode.trim() || null,
        country: siteModalState.country.trim() || null,
        accessNotes: siteModalState.accessNotes.trim() || null,
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
          // ignore
        }
        throw new Error(detail ?? "Failed to create site.");
      }

      const data = (await response.json()) as SingleResponse<Site>;
      setShowSiteModal(false);
      setSiteModalState(createSiteModalState());
      // refresh both sites and potentially assets filtered by site
      await refreshSites(data.data.id);
      await refreshAssets();
    } catch (error) {
      console.error(error);
      setSiteModalError(error instanceof Error ? error.message : "Failed to create site.");
    } finally {
      setSiteModalSaving(false);
    }
  };

  const handleAssetModalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssetModalError(null);
    if (
      !assetModalState.customerId.trim() ||
      !assetModalState.siteId.trim() ||
      !assetModalState.name.trim()
    ) {
      setAssetModalError("Customer, site, and asset name are required.");
      return;
    }

    try {
      setAssetModalSaving(true);
      const payload = {
        customerId: assetModalState.customerId,
        siteId: assetModalState.siteId,
        name: assetModalState.name.trim(),
        manufacturer: toNullable(assetModalState.manufacturer),
        model: toNullable(assetModalState.model),
        serialNumber: toNullable(assetModalState.serialNumber),
        assetTag: toNullable(assetModalState.assetTag),
        location: toNullable(assetModalState.location),
        notes: toNullable(assetModalState.notes),
        status: assetModalState.status,
        criticality: assetModalState.criticality || null,
      };

      const response = await apiFetch("/api/assets", {
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
          // ignore
        }
        throw new Error(detail ?? "Failed to create asset.");
      }

      const data = (await response.json()) as SingleResponse<Asset>;
      setShowAssetModal(false);
      setAssetModalState(createAssetModalState());
      await refreshAssets(data.data.id);
    } catch (error) {
      console.error(error);
      setAssetModalError(error instanceof Error ? error.message : "Failed to create asset.");
    } finally {
      setAssetModalSaving(false);
    }
  };

  const handleCustomerSelectChange = (value: string) => {
    if (value === NEW_CUSTOMER_VALUE) {
      openCustomerModal();
      return;
    }
    handleFieldChange("customerId", value);
  };

  const handleSiteSelectChange = (value: string) => {
    if (value === NEW_SITE_VALUE) {
      openSiteModal();
      return;
    }
    handleFieldChange("siteId", value);
  };

  const handleAssetSelectChange = (value: string) => {
    if (value === NEW_ASSET_VALUE) {
      openAssetModal();
      return;
    }
    handleFieldChange("assetId", value);
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setCustomerModalError(null);
  };

  const closeSiteModal = () => {
    setShowSiteModal(false);
    setSiteModalError(null);
  };

  const closeAssetModal = () => {
    setShowAssetModal(false);
    setAssetModalError(null);
  };

  const assetModalSites = useMemo(() => {
    if (!assetModalState.customerId) return sites;
    return sites.filter((site) => site.customerId === assetModalState.customerId);
  }, [assetModalState.customerId, sites]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!canSubmit) {
      setSubmitError("Title, customer, and site are required.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiFetch("/api/work-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: form.customerId,
          siteId: form.siteId,
          assetId: form.assetId || null,
          title: form.title.trim(),
          description: form.description.trim() ? form.description.trim() : null,
          executionMode: form.executionMode,
        }),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const payload = (await response.json()) as { error?: string };
          detail = payload.error;
        } catch {
          // ignore
        }
        throw new Error(detail ?? "Failed to create work order.");
      }

      setForm(createInitialFormState());
      setSubmitSuccess("Work order created.");
      await refreshWorkOrders();
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Failed to create work order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {loadError && (
        <div className="page-alert error">
          Failed to load data: {loadError} – refresh the page or try again.
        </div>
      )}
      {!loadError && loading && (
        <div className="page-alert info">Loading work order data…</div>
      )}
      <div className="page-header">
        <div>
          <h2>Work Orders</h2>
          <p>Dispatch queue and SLA tracking.</p>
        </div>
        <span className="badge">Dispatcher view</span>
      </div>

      <div className="card">
        <h3>Create work order</h3>
        <form className="work-order-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Title</span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => handleFieldChange("title", event.target.value)}
              placeholder="Short summary"
              disabled={loading || submitting}
              required
            />
          </label>

          <label className="form-field">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => handleFieldChange("description", event.target.value)}
              placeholder="Optional context for technicians"
              rows={3}
              disabled={loading || submitting}
            />
          </label>

          <label className="form-field">
            <span>Customer</span>
            <select
              value={form.customerId}
              onChange={(event) => handleCustomerSelectChange(event.target.value)}
              disabled={loading || submitting}
              required
            >
              <option value="">Select a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
              <option value={NEW_CUSTOMER_VALUE}>➕ Add new customer…</option>
            </select>
          </label>

          <label className="form-field">
            <span>Site</span>
            <select
              value={form.siteId}
              onChange={(event) => handleSiteSelectChange(event.target.value)}
              disabled={loading || submitting}
              required
            >
              <option value="">Select a site</option>
              {filteredSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
              <option value={NEW_SITE_VALUE}>➕ Add new site…</option>
            </select>
          </label>

          <label className="form-field">
            <span>Asset (optional)</span>
            <select
              value={form.assetId}
              onChange={(event) => handleAssetSelectChange(event.target.value)}
              disabled={loading || submitting}
            >
              <option value="">No linked asset</option>
              {filteredAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {formatAssetOptionLabel(asset)}
                </option>
              ))}
              <option value={NEW_ASSET_VALUE}>➕ Add new asset…</option>
            </select>
          </label>

          <label className="form-field">
            <span>Execution mode</span>
            <select
              value={form.executionMode}
              onChange={(event) => handleFieldChange("executionMode", event.target.value)}
              disabled={loading || submitting}
            >
              {executionModeOptions.map((mode) => (
                <option key={mode} value={mode}>
                  {executionModeLabels[mode]}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Create work order"}
          </button>

          {submitError && <p className="form-feedback error">{submitError}</p>}
          {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Existing work orders</h3>
          <button
            type="button"
            className="link-button"
            onClick={refreshWorkOrders}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p>Loading work orders…</p>
        ) : workOrders.length === 0 ? (
          <p>No work orders yet. Create the first one above.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>WO #</th>
                  <th>Title</th>
                  <th>Status</th>
                <th>Execution mode</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                    <td>{(workOrder as any).workOrderNumber ?? "—"}</td>
                    <td>{workOrder.title}</td>
                  <td>{workOrder.status}</td>
                  <td>{executionModeLabels[workOrder.executionMode]}</td>
                  <td>{new Date(workOrder.updatedAt).toLocaleString()}</td>
                  <td>
                    <Link className="link-button" href={`/work-orders/${workOrder.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showCustomerModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Add customer</h3>
            <form onSubmit={handleCustomerModalSubmit} className="modal-form">
              <label className="form-field">
                <span>Name</span>
                <input
                  value={customerModalState.name}
                  onChange={(event) =>
                    setCustomerModalState({ name: event.target.value })
                  }
                  placeholder="Customer name"
                  required
                />
              </label>
              {customerModalError && (
                <p className="form-feedback error">{customerModalError}</p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={closeCustomerModal}
                  disabled={customerModalSaving}
                >
                  Cancel
                </button>
                <button type="submit" disabled={customerModalSaving}>
                  {customerModalSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSiteModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Add site</h3>
            <form onSubmit={handleSiteModalSubmit} className="modal-form">
              <label className="form-field">
                <span>Customer</span>
                <select
                  value={siteModalState.customerId}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({
                      ...prev,
                      customerId: event.target.value,
                    }))
                  }
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
                  value={siteModalState.name}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Facility name"
                  required
                />
              </label>

              <label className="form-field">
                <span>Address</span>
                <input
                  value={siteModalState.address}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({ ...prev, address: event.target.value }))
                  }
                  placeholder="123 Main St"
                />
              </label>

              <label className="form-field">
                <span>City</span>
                <input
                  value={siteModalState.city}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({ ...prev, city: event.target.value }))
                  }
                  placeholder="City"
                />
              </label>

              <label className="form-field">
                <span>State / Province</span>
                <input
                  value={siteModalState.state}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({ ...prev, state: event.target.value }))
                  }
                  placeholder="State"
                />
              </label>

              <label className="form-field">
                <span>Postal code</span>
                <input
                  value={siteModalState.postalCode}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({
                      ...prev,
                      postalCode: event.target.value,
                    }))
                  }
                  placeholder="Postal code"
                />
              </label>

              <label className="form-field">
                <span>Country</span>
                <input
                  value={siteModalState.country}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({ ...prev, country: event.target.value }))
                  }
                  placeholder="Country"
                />
              </label>

              <label className="form-field">
                <span>Access notes</span>
                <textarea
                  rows={3}
                  value={siteModalState.accessNotes}
                  onChange={(event) =>
                    setSiteModalState((prev) => ({
                      ...prev,
                      accessNotes: event.target.value,
                    }))
                  }
                  placeholder="Gate codes, onsite contacts, parking…"
                />
              </label>

              {siteModalError && <p className="form-feedback error">{siteModalError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="link-button"
                  onClick={closeSiteModal}
                  disabled={siteModalSaving}
                >
                  Cancel
                </button>
                <button type="submit" disabled={siteModalSaving}>
                  {siteModalSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssetModal && (
        <div className="modal-backdrop">
          <div
            className="modal"
            style={{
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <h3>Add asset</h3>
            <form
              onSubmit={handleAssetModalSubmit}
              className="modal-form"
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                flex: 1,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  overflowY: "auto",
                  paddingRight: 4,
                  paddingBottom: 8,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <label className="form-field">
                  <span>Customer</span>
                  <select
                    value={assetModalState.customerId}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        customerId: event.target.value,
                        siteId:
                          prev.siteId &&
                          sites.find(
                            (site) =>
                              site.id === prev.siteId &&
                              site.customerId === event.target.value
                          )
                            ? prev.siteId
                            : "",
                      }))
                    }
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
                  <span>Site</span>
                  <select
                    value={assetModalState.siteId}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        siteId: event.target.value,
                      }))
                    }
                    required
                    disabled={!assetModalState.customerId}
                  >
                    <option value="">Select a site</option>
                    {assetModalSites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Asset name</span>
                  <input
                    value={assetModalState.name}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Asset name"
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Manufacturer</span>
                  <input
                    value={assetModalState.manufacturer}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        manufacturer: event.target.value,
                      }))
                    }
                    placeholder="OEM name"
                    maxLength={80}
                  />
                </label>

                <label className="form-field">
                  <span>Model</span>
                  <input
                    value={assetModalState.model}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({ ...prev, model: event.target.value }))
                    }
                    placeholder="Model or family"
                    maxLength={80}
                  />
                </label>

                <label className="form-field">
                  <span>Serial number</span>
                  <input
                    value={assetModalState.serialNumber}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        serialNumber: event.target.value,
                      }))
                    }
                    placeholder="Serial number"
                    maxLength={80}
                  />
                </label>

                <label className="form-field">
                  <span>Asset tag / ID</span>
                  <input
                    value={assetModalState.assetTag}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        assetTag: event.target.value,
                      }))
                    }
                    placeholder="Plant tag or barcode"
                    maxLength={80}
                  />
                </label>

                <label className="form-field">
                  <span>Location</span>
                  <input
                    value={assetModalState.location}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        location: event.target.value,
                      }))
                    }
                    placeholder="Mechanical room B"
                    maxLength={160}
                  />
                </label>

                <label className="form-field">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={assetModalState.notes}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Maintenance notes, safety callouts…"
                    maxLength={5000}
                  />
                </label>

                <label className="form-field">
                  <span>Status</span>
                  <select
                    value={assetModalState.status}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        status: event.target.value as AssetStatus,
                      }))
                    }
                    required
                  >
                    {Object.values(AssetStatus).map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Criticality</span>
                  <select
                    value={assetModalState.criticality}
                    onChange={(event) =>
                      setAssetModalState((prev) => ({
                        ...prev,
                        criticality: event.target.value as AssetCriticality | "",
                      }))
                    }
                  >
                    <option value="">Not set</option>
                    {Object.values(AssetCriticality).map((value) => (
                      <option key={value} value={value}>
                        {value.charAt(0) + value.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>

                {assetModalError && (
                  <p className="form-feedback error">{assetModalError}</p>
                )}
              </div>
              <div
                className="modal-actions"
                style={{
                  position: "sticky",
                  bottom: 0,
                  background: "var(--panel)",
                  paddingTop: 12,
                  zIndex: 1,
                }}
              >
                <button
                  type="button"
                  className="link-button"
                  onClick={closeAssetModal}
                  disabled={assetModalSaving}
                >
                  Cancel
                </button>
                <button type="submit" disabled={assetModalSaving}>
                  {assetModalSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
