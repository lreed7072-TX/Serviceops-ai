"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ExecutionMode, OrderType, WorkOrderStatus } from "@prisma/client";

interface WorkOrder {
  id: string;
  workOrderNumber: string | null;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  executionMode: ExecutionMode;
  orderType: OrderType;
  customerId: string;
  siteId: string;
  assetId: string | null;
  customer: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
  asset: { id: string; name: string } | null;
}

interface Customer {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  customerId: string;
}

interface Asset {
  id: string;
  name: string;
  customerId: string;
  siteId: string;
}

export default function EditWorkOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workOrderId = params?.id;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(ExecutionMode.UNIFIED);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.WORK_ORDER);

  useEffect(() => {
    if (workOrderId) {
      loadData();
    }
  }, [workOrderId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [woRes, custRes, siteRes, assetRes] = await Promise.all([
        fetch(`/api/work-orders/${workOrderId}`),
        fetch("/api/customers"),
        fetch("/api/sites"),
        fetch("/api/assets"),
      ]);

      if (!woRes.ok) {
        throw new Error("Work order not found");
      }

      const woData = await woRes.json();
      const custData = await custRes.json();
      const siteData = await siteRes.json();
      const assetData = await assetRes.json();

      const wo = woData.data;
      setWorkOrder(wo);
      setCustomers(custData.data || []);
      setSites(siteData.data || []);
      setAssets(assetData.data || []);

      // Populate form
      setTitle(wo.title || "");
      setDescription(wo.description || "");
      setCustomerId(wo.customerId || "");
      setSiteId(wo.siteId || "");
      setAssetId(wo.assetId || "");
      setExecutionMode(wo.executionMode || ExecutionMode.UNIFIED);
      setOrderType(wo.orderType || OrderType.WORK_ORDER);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work order");
    } finally {
      setLoading(false);
    }
  };

  const filteredSites = sites.filter((s) => !customerId || s.customerId === customerId);
  const filteredAssets = assets.filter(
    (a) => (!customerId || a.customerId === customerId) && (!siteId || a.siteId === siteId)
  );

  const handleCustomerChange = (value: string) => {
    setCustomerId(value);
    setSiteId("");
    setAssetId("");
  };

  const handleSiteChange = (value: string) => {
    setSiteId(value);
    setAssetId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!customerId || !siteId) {
      setError("Customer and site are required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          customerId,
          siteId,
          assetId: assetId || null,
          executionMode,
          orderType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update work order");
      }

      setSuccess("Work order updated successfully");
      setTimeout(() => {
        router.push(`/work-orders/${workOrderId}`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update work order");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="wo-detail-container">
        <div className="loading-state">
          <div className="loading-spinner-large"></div>
          <div className="loading-text">Loading work order...</div>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="wo-detail-container">
        <div className="loading-state">
          <div className="loading-text">Work order not found</div>
          <button
            onClick={() => router.push("/work-orders")}
            style={{ marginTop: "16px" }}
            className="action-button secondary"
          >
            Back to Work Orders
          </button>
        </div>
      </div>
    );
  }

  // Don't allow editing completed or canceled work orders
  if (workOrder.status === WorkOrderStatus.COMPLETED || workOrder.status === WorkOrderStatus.CANCELED) {
    return (
      <div className="wo-detail-container">
        <div className="loading-state">
          <div className="loading-text">
            Cannot edit a {workOrder.status.toLowerCase()} work order
          </div>
          <button
            onClick={() => router.push(`/work-orders/${workOrderId}`)}
            style={{ marginTop: "16px" }}
            className="action-button secondary"
          >
            Back to Work Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wo-detail-container">
      <button onClick={() => router.push(`/work-orders/${workOrderId}`)} className="back-link">
        ← Back to Work Order
      </button>

      <div className="wo-section">
        <h2 className="wo-section-title">
          <span className="section-icon">✏️</span>
          Edit Work Order: {workOrder.workOrderNumber || `WO-${workOrder.id.slice(0, 8)}`}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
          <div className="form-field">
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#374151" }}>
              Order Type
            </label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as OrderType)}
              disabled={saving}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              <option value={OrderType.WORK_ORDER}>Work Order (WO)</option>
              <option value={OrderType.SALES_ORDER}>Sales Order (SO)</option>
              <option value={OrderType.PROJECT}>Project (PJ)</option>
            </select>
          </div>

          <div className="form-field">
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#374151" }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            />
          </div>

          <div className="form-field">
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#374151" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          <div className="form-field">
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#374151" }}>
              Customer *
            </label>
            <select
              value={customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              disabled={saving}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
              }}
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
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#374151" }}>
              Site *
            </label>
            <select
              value={siteId}
              onChange={(e) => handleSiteChange(e.target.value)}
              disabled={saving || !customerId}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
              }}
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
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#374151" }}>
              Asset (optional)
            </label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              disabled={saving || !siteId}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              <option value="">No linked asset</option>
              {filteredAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#374151" }}>
              Execution Mode
            </label>
            <select
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value as ExecutionMode)}
              disabled={saving}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "2px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              <option value={ExecutionMode.UNIFIED}>Unified</option>
              <option value={ExecutionMode.MULTI_LANE}>Multi-lane</option>
            </select>
          </div>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#dc2626",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: "12px 16px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                color: "#16a34a",
                fontSize: "14px",
              }}
            >
              {success}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => router.push(`/work-orders/${workOrderId}`)}
              disabled={saving}
              className="action-button secondary"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="action-button primary"
              style={{ flex: 1 }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
