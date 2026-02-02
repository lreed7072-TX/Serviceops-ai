"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AssetCriticality, AssetStatus, ExecutionMode, OrderType, WorkOrderStatus } from "@prisma/client";
import type { Asset, Customer, Site, WorkOrder } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import "./work-orders.css";

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
  orderType: OrderType;
  standardsPackId: string;
};

type StandardsPack = {
  id: string;
  name: string;
  equipmentType: string | null;
  _count: { tasks: number };
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

const orderTypeLabels: Record<OrderType, string> = {
  WORK_ORDER: "Work Order (WO)",
  SALES_ORDER: "Sales Order (SO)",
  PROJECT: "Project (PJ)",
};

const orderTypeOptions: OrderType[] = [
  OrderType.WORK_ORDER,
  OrderType.SALES_ORDER,
  OrderType.PROJECT,
];

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
  orderType: OrderType.WORK_ORDER,
  standardsPackId: "",
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
  const router = useRouter();
  
  // State - Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [standardsPacks, setStandardsPacks] = useState<StandardsPack[]>([]);
  
  // State - Form
  const [form, setForm] = useState<WorkOrderFormState>(() => createInitialFormState());
  
  // State - UI
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // State - Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterExecution, setFilterExecution] = useState<string>("all");
  
  // State - Modals
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

  // Load data on mount
  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        const [customerData, siteData, assetData, workOrderData, packsData] = await Promise.all([
          fetchList<Customer>("/api/customers"),
          fetchList<Site>("/api/sites"),
          fetchList<Asset>("/api/assets"),
          fetchList<WorkOrder>("/api/work-orders"),
          fetchList<StandardsPack>("/api/standards-packs?status=ACTIVE"),
        ]);
        if (!active) return;
        setCustomers(customerData);
        setSites(siteData);
        setAssets(assetData);
        setWorkOrders(workOrderData);
        setStandardsPacks(packsData);
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

  // Computed values - Filtered dropdowns
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

  // Computed values - Filtered work orders
  const filteredWorkOrders = useMemo(() => {
    let filtered = [...workOrders];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(wo => 
        wo.title.toLowerCase().includes(query) ||
        wo.status.toLowerCase().includes(query) ||
        (wo as any).workOrderNumber?.toLowerCase().includes(query) ||
        (wo as any).description?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (filterStatus && filterStatus !== "all") {
      filtered = filtered.filter(wo => wo.status.toLowerCase() === filterStatus.toLowerCase());
    }
    
    // Type filter
    if (filterType && filterType !== "all") {
      filtered = filtered.filter(wo => (wo as any).orderType === filterType);
    }
    
    // Execution filter
    if (filterExecution && filterExecution !== "all") {
      filtered = filtered.filter(wo => wo.executionMode === filterExecution);
    }
    
    return filtered;
  }, [workOrders, searchQuery, filterStatus, filterType, filterExecution]);

  // Computed values - Statistics
  const stats = useMemo(() => {
    const total = workOrders.length;
    const open = workOrders.filter(wo => wo.status === WorkOrderStatus.OPEN).length;
    const inProgress = workOrders.filter(wo => wo.status === WorkOrderStatus.IN_PROGRESS).length;
    const completed = workOrders.filter(wo => wo.status === WorkOrderStatus.COMPLETED).length;
    
    return { total, open, inProgress, completed };
  }, [workOrders]);

  const canSubmit =
    form.title.trim().length > 0 && form.customerId.length > 0 && form.siteId.length > 0;

  // Refresh functions
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

  // Form field handlers
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
      if (field === "orderType") {
        return { ...prev, orderType: value as OrderType };
      }
      return { ...prev, [field]: value };
    });
  };

  // Modal handlers
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

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterType("all");
    setFilterExecution("all");
  };

  const hasActiveFilters = searchQuery || filterStatus !== "all" || filterType !== "all" || filterExecution !== "all";

  // Modal submit handlers
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

  // Main work order submit
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
          orderType: form.orderType,
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

      const woData = (await response.json()) as SingleResponse<WorkOrder>;
      const newWorkOrderId = woData.data.id;

      // Apply standards pack if selected
      if (form.standardsPackId) {
        try {
          const applyRes = await apiFetch(`/api/standards-packs/${form.standardsPackId}/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workOrderId: newWorkOrderId }),
          });
          if (!applyRes.ok) {
            console.error("Failed to apply standards pack");
          }
        } catch (e) {
          console.error("Failed to apply standards pack", e);
        }
      }

      setForm(createInitialFormState());
      setSubmitSuccess("Work order created." + (form.standardsPackId ? " Tasks generated from pack." : ""));
      await refreshWorkOrders();
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Failed to create work order.");
    } finally {
      setSubmitting(false);
    }
  };

  // JSX Return
  return (
    <div>
      {loadError && (
        <div className="page-alert error">
          Failed to load data: {loadError} – refresh the page or try again.
        </div>
      )}
      
      <PageHeader
        title="Work Orders"
        subtitle="Dispatch queue and SLA tracking."
        right={
          <>
            <Badge>Dispatcher view</Badge>
          </>
        }
      />

      {/* Statistics Cards */}
      {!loadError && !loading && (
        <div className="stats-grid">
          <div className="stat-card stat-total">
            <div className="stat-label">
              <span className="stat-icon">📋</span>
              Total Orders
            </div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-change">All work orders</div>
          </div>

          <div className="stat-card stat-open">
            <div className="stat-label">
              <span className="stat-icon">📝</span>
              Open Orders
            </div>
            <div className="stat-value">{stats.open}</div>
            <div className="stat-change">Awaiting dispatch</div>
          </div>

          <div className="stat-card stat-in-progress">
            <div className="stat-label">
              <span className="stat-icon">⚙️</span>
              In Progress
            </div>
            <div className="stat-value">{stats.inProgress}</div>
            <div className="stat-change">Active work</div>
          </div>

          <div className="stat-card stat-completed">
            <div className="stat-label">
              <span className="stat-icon">✅</span>
              Completed
            </div>
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-change">Finished this period</div>
          </div>

          <div className="stat-card stat-revenue">
            <div className="stat-label">
              <span className="stat-icon">💰</span>
              Est. Revenue
            </div>
            <div className="stat-value">$0</div>
            <div className="stat-change">Billing pipeline</div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      {!loadError && !loading && (
        <div className="search-filters-container">
          <div className="search-bar-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by title, number, status, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">
                <span>📊</span> Status
              </label>
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">
                <span>🏷️</span> Type
              </label>
              <select
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="WORK_ORDER">Work Order</option>
                <option value="SALES_ORDER">Sales Order</option>
                <option value="PROJECT">Project</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">
                <span>⚡</span> Execution
              </label>
              <select
                className="filter-select"
                value={filterExecution}
                onChange={(e) => setFilterExecution(e.target.value)}
              >
                <option value="all">All Modes</option>
                <option value="UNIFIED">Unified</option>
                <option value="MULTI_LANE">Multi-lane</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="search-results-text">
              Showing <strong>{filteredWorkOrders.length}</strong> of <strong>{workOrders.length}</strong> work orders
              <button className="clear-filters-btn" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading work orders...</div>
        </div>
      )}

      {/* Work Orders Grid */}
      {!loadError && !loading && (
        <>
          {filteredWorkOrders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">
                {searchQuery || hasActiveFilters ? "No matching work orders" : "No work orders yet"}
              </div>
              <div className="empty-message">
                {searchQuery || hasActiveFilters
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : "Create your first work order using the form below to get started with dispatching and tracking jobs."}
              </div>
              {(searchQuery || hasActiveFilters) && (
                <button className="empty-action" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="work-orders-grid">
              {filteredWorkOrders.map((wo) => {
                const woNumber = (wo as any).workOrderNumber || `WO-${wo.id.slice(0, 8).toUpperCase()}`;
                const woType = ((wo as any).orderType || "WORK_ORDER").toLowerCase().replace("_", "-");
                const woTypeLabel = ((wo as any).orderType || "WORK_ORDER").replace("_", " ");
                const woStatus = wo.status.toLowerCase().replace("_", "-");
                const woStatusLabel = wo.status.replace("_", " ");
                const customer = customers.find(c => c.id === wo.customerId);
                const site = sites.find(s => s.id === wo.siteId);
                const updatedDate = new Date(wo.updatedAt).toLocaleDateString();

                return (
                  <div
                    key={wo.id}
                    className={`wo-card status-${woStatus}`}
                    onClick={() => router.push(`/work-orders/${wo.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/work-orders/${wo.id}`);
                      }
                    }}
                  >
                    <div className="wo-card-header">
                      <div className="wo-number">{woNumber}</div>
                      <div className="wo-badges">
                        <span className={`wo-type-badge ${woType}`}>{woTypeLabel}</span>
                      </div>
                    </div>

                    <div className="wo-title">{wo.title}</div>

                    <div className="wo-meta">
                      <div className="wo-meta-item">
                        <span className="wo-meta-icon">🏢</span>
                        <span className="wo-meta-label">Customer:</span>
                        <span className="wo-meta-value">{customer?.name || "—"}</span>
                      </div>
                      <div className="wo-meta-item">
                        <span className="wo-meta-icon">📍</span>
                        <span className="wo-meta-label">Site:</span>
                        <span className="wo-meta-value">{site?.name || "—"}</span>
                      </div>
                      <div className="wo-meta-item">
                        <span className="wo-meta-icon">⚡</span>
                        <span className="wo-meta-label">Mode:</span>
                        <span className="wo-meta-value">{executionModeLabels[wo.executionMode]}</span>
                      </div>
                    </div>

                    {(wo as any).description && (
                      <div className="wo-description">{(wo as any).description}</div>
                    )}

                    <div className="wo-footer">
                      <span className={`wo-status-badge ${woStatus}`}>{woStatusLabel}</span>
                      <span className="wo-view-link">
                        View Details →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Work Order Form */}
      <div className="create-wo-section">
        <h3 className="section-title">
          <span className="section-title-icon">➕</span>
          Create New Work Order
        </h3>
        
        <form className="work-order-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Order Type</span>
            <select
              value={form.orderType}
              onChange={(event) => handleFieldChange("orderType", event.target.value)}
              disabled={loading || submitting}
            >
              {orderTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {orderTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>

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

          <label className="form-field">
            <span>Standards Pack (optional)</span>
            <select
              value={form.standardsPackId}
              onChange={(event) => setForm((prev) => ({ ...prev, standardsPackId: event.target.value }))}
              disabled={loading || submitting}
            >
              <option value="">No pack - create tasks manually</option>
              {standardsPacks.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name} ({pack._count.tasks} tasks){pack.equipmentType ? ` - ${pack.equipmentType}` : ""}
                </option>
              ))}
            </select>
            {standardsPacks.length === 0 && (
              <small style={{ color: "var(--muted)", marginTop: 4 }}>
                No active packs. <a href="/standards-packs">Create one</a>
              </small>
            )}
          </label>

          <button type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Saving..." : "Create work order"}
          </button>

          {submitError && <p className="form-feedback error">{submitError}</p>}
          {submitSuccess && <p className="form-feedback success">{submitSuccess}</p>}
        </form>
      </div>

      {/* Customer Modal */}
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

      {/* Site Modal */}
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

      {/* Asset Modal */}
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
