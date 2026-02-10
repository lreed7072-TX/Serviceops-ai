"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ExecutionMode, OrderType, WorkOrderStatus, TaskStatus } from "@prisma/client";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  sequenceNumber: number | null;
  isCritical: boolean;
  requiresEvidence: boolean;
  assignedTo: { id: string; name: string } | null;
}

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

interface User {
  id: string;
  name: string;
}

export default function EditWorkOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workOrderId = params?.id;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  // New task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCritical, setNewTaskCritical] = useState(false);
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Template integration state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [standardsPacks, setStandardsPacks] = useState<any[]>([]);
  const [procedureTemplates, setProcedureTemplates] = useState<any[]>([]);
  const [selectedTemplateType, setSelectedTemplateType] = useState<"pack" | "procedure" | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateTasks, setTemplateTasks] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (workOrderId) {
      loadData();
    }
  }, [workOrderId]);

  useEffect(() => {
    if (selectedTemplateId && selectedTemplateType) {
      loadTemplateTasks();
    }
  }, [selectedTemplateId, selectedTemplateType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [woRes, custRes, siteRes, assetRes, tasksRes, usersRes] = await Promise.all([
        fetch(`/api/work-orders/${workOrderId}`),
        fetch("/api/customers"),
        fetch("/api/sites"),
        fetch("/api/assets"),
        fetch(`/api/work-orders/${workOrderId}/tasks`),
        fetch("/api/users"),
      ]);

      if (!woRes.ok) {
        throw new Error("Work order not found");
      }

      const woData = await woRes.json();
      const custData = await custRes.json();
      const siteData = await siteRes.json();
      const assetData = await assetRes.json();
      const tasksData = tasksRes.ok ? await tasksRes.json() : { data: [] };
      const usersData = usersRes.ok ? await usersRes.json() : { data: [] };

      const wo = woData.data;
      setWorkOrder(wo);
      setCustomers(custData.data || []);
      setSites(siteData.data || []);
      setAssets(assetData.data || []);
      setTasks(tasksData.data || []);
      setUsers(usersData.data || []);

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

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);

    if (!newTaskTitle.trim()) {
      setTaskError("Task title is required");
      return;
    }

    setAddingTask(true);
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          isCritical: newTaskCritical,
          assignedToId: newTaskAssignee || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create task");
      }

      const data = await response.json();
      setTasks([...tasks, data.data]);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskCritical(false);
      setNewTaskAssignee("");
      setShowTaskForm(false);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setAddingTask(false);
    }
  };

  // Load templates when selector is opened
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const [packsRes, templatesRes] = await Promise.all([
        fetch("/api/standards-packs?status=ACTIVE"),
        fetch("/api/procedure-templates")
      ]);

      if (packsRes.ok) {
        const packsData = await packsRes.json();
        setStandardsPacks(packsData.data || []);
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setProcedureTemplates(templatesData.data || []);
      }
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load tasks from selected template
  const loadTemplateTasks = async () => {
    if (!selectedTemplateType || !selectedTemplateId) return;

    setLoadingTemplates(true);
    try {
      const endpoint = selectedTemplateType === "pack"
        ? `/api/standards-packs/${selectedTemplateId}`
        : `/api/procedure-templates/${selectedTemplateId}`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to load template tasks");

      const data = await res.json();
      const tasks = selectedTemplateType === "pack"
        ? data.data.tasks
        : data.data.steps?.map((step: any) => ({
            title: step.title,
            description: step.description,
            isCritical: step.isCritical || false,
            sequenceNumber: step.sequenceNumber
          }));

      setTemplateTasks(tasks || []);
    } catch (err) {
      setTaskError("Failed to load template tasks");
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Add all template tasks to work order
  const addTemplateTasks = async () => {
    if (templateTasks.length === 0) return;

    setAddingTask(true);
    setTaskError(null);

    try {
      const currentMaxSequence = Math.max(...tasks.map(t => t.sequenceNumber || 0), 0);

      for (let i = 0; i < templateTasks.length; i++) {
        const task = templateTasks[i];
        const response = await fetch(`/api/work-orders/${workOrderId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            description: task.description || null,
            isCritical: task.isCritical || false,
            sequenceNumber: currentMaxSequence + i + 1,
            assignedToId: null,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create task: ${task.title}`);
        }

        const data = await response.json();
        setTasks(prev => [...prev, data.data]);
      }

      // Reset template selector
      setShowTemplateSelector(false);
      setSelectedTemplateType(null);
      setSelectedTemplateId("");
      setTemplateTasks([]);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to add template tasks");
    } finally {
      setAddingTask(false);
    }
  };

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return { bg: "#f3f4f6", color: "#6b7280" };
      case TaskStatus.IN_PROGRESS:
        return { bg: "#fef3c7", color: "#92400e" };
      case TaskStatus.DONE:
        return { bg: "#d1fae5", color: "#065f46" };
      case TaskStatus.BLOCKED:
        return { bg: "#fee2e2", color: "#991b1b" };
      default:
        return { bg: "#f3f4f6", color: "#6b7280" };
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

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontWeight: 600,
    color: "#374151",
  };

  return (
    <div className="wo-detail-container">
      <button onClick={() => router.push(`/work-orders/${workOrderId}`)} className="back-link">
        ← Back to Work Order
      </button>

      {/* Work Order Details Section */}
      <div className="wo-section">
        <h2 className="wo-section-title">
          <span className="section-icon">✏️</span>
          Edit Work Order: {workOrder.workOrderNumber || `WO-${workOrder.id.slice(0, 8)}`}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
          <div className="form-field">
            <label style={labelStyle}>Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as OrderType)}
              disabled={saving}
              style={inputStyle}
            >
              <option value={OrderType.WORK_ORDER}>Work Order (WO)</option>
              <option value={OrderType.SALES_ORDER}>Sales Order (SO)</option>
              <option value={OrderType.PROJECT}>Project (PJ)</option>
            </select>
          </div>

          <div className="form-field">
            <label style={labelStyle}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              required
              style={inputStyle}
            />
          </div>

          <div className="form-field">
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-field">
              <label style={labelStyle}>Customer *</label>
              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                disabled={saving}
                required
                style={inputStyle}
              >
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label style={labelStyle}>Site *</label>
              <select
                value={siteId}
                onChange={(e) => handleSiteChange(e.target.value)}
                disabled={saving || !customerId}
                required
                style={inputStyle}
              >
                <option value="">Select a site</option>
                {filteredSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-field">
              <label style={labelStyle}>Asset (optional)</label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                disabled={saving || !siteId}
                style={inputStyle}
              >
                <option value="">No linked asset</option>
                {filteredAssets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label style={labelStyle}>Execution Mode</label>
              <select
                value={executionMode}
                onChange={(e) => setExecutionMode(e.target.value as ExecutionMode)}
                disabled={saving}
                style={inputStyle}
              >
                <option value={ExecutionMode.UNIFIED}>Unified</option>
                <option value={ExecutionMode.MULTI_LANE}>Multi-lane</option>
              </select>
            </div>
          </div>

          {error && (
            <div style={{
              padding: "12px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#dc2626",
              fontSize: "14px",
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: "12px 16px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              color: "#16a34a",
              fontSize: "14px",
            }}>
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

      {/* Tasks Section */}
      <div className="wo-section" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 className="wo-section-title" style={{ marginBottom: 0 }}>
            <span className="section-icon">✓</span>
            Tasks ({tasks.length})
          </h2>
          {!showTaskForm && !showTemplateSelector && (
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => {
                  setShowTemplateSelector(true);
                  loadTemplates();
                }}
                className="action-button secondary"
                style={{ padding: "8px 16px", fontSize: "14px" }}
              >
                📋 Load from Template
              </button>
              <button
                onClick={() => setShowTaskForm(true)}
                className="action-button primary"
                style={{ padding: "8px 16px", fontSize: "14px" }}
              >
                + Add Task
              </button>
            </div>
          )}
        </div>

        {/* Template Selector */}
        {showTemplateSelector && (
          <div style={{
            background: "#f0f9ff",
            border: "2px solid #0284c7",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#0c4a6e" }}>
                📋 Load Tasks from Template
              </h3>
              <button
                onClick={() => {
                  setShowTemplateSelector(false);
                  setSelectedTemplateType(null);
                  setSelectedTemplateId("");
                  setTemplateTasks([]);
                }}
                style={{ padding: "4px 12px", fontSize: "13px" }}
                className="action-button secondary"
              >
                Cancel
              </button>
            </div>

            {/* Template Type Selection */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ ...labelStyle, marginBottom: "8px" }}>Template Type</label>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplateType("pack");
                    setSelectedTemplateId("");
                    setTemplateTasks([]);
                  }}
                  className={selectedTemplateType === "pack" ? "action-button primary" : "action-button secondary"}
                  style={{ flex: 1, padding: "10px" }}
                >
                  Standards Packs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplateType("procedure");
                    setSelectedTemplateId("");
                    setTemplateTasks([]);
                  }}
                  className={selectedTemplateType === "procedure" ? "action-button primary" : "action-button secondary"}
                  style={{ flex: 1, padding: "10px" }}
                >
                  Procedure Templates
                </button>
              </div>
            </div>

            {/* Template Selection */}
            {selectedTemplateType && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ ...labelStyle, marginBottom: "8px" }}>
                  Select {selectedTemplateType === "pack" ? "Standards Pack" : "Procedure Template"}
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    if (!e.target.value) {
                      setTemplateTasks([]);
                    }
                  }}
                  style={{ ...inputStyle, marginBottom: "12px" }}
                >
                  <option value="">Choose template...</option>
                  {selectedTemplateType === "pack"
                    ? standardsPacks.map((pack) => (
                        <option key={pack.id} value={pack.id}>
                          {pack.name} ({pack._count?.tasks || 0} tasks)
                        </option>
                      ))
                    : procedureTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template._count?.steps || 0} steps)
                        </option>
                      ))
                  }
                </select>
              </div>
            )}

            {/* Preview Template Tasks */}
            {templateTasks.length > 0 && (
              <div>
                <div style={{ 
                  fontSize: "14px", 
                  fontWeight: 600, 
                  marginBottom: "12px",
                  color: "#0c4a6e"
                }}>
                  Preview: {templateTasks.length} task{templateTasks.length !== 1 ? "s" : ""} will be added
                </div>
                <div style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto",
                  background: "white",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "16px"
                }}>
                  {templateTasks.map((task, idx) => (
                    <div key={idx} style={{ 
                      padding: "8px",
                      borderBottom: idx < templateTasks.length - 1 ? "1px solid #e5e7eb" : "none"
                    }}>
                      <div style={{ fontWeight: 500, fontSize: "14px" }}>
                        {idx + 1}. {task.title}
                        {task.isCritical && <span style={{ color: "#dc2626", marginLeft: "8px" }}>🔴 Critical</span>}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                          {task.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addTemplateTasks}
                  disabled={addingTask}
                  className="action-button success"
                  style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 600 }}
                >
                  {addingTask ? "Adding Tasks..." : `Add All ${templateTasks.length} Task${templateTasks.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {loadingTemplates && (
              <div style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>
                Loading templates...
              </div>
            )}

            {taskError && (
              <div style={{
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#dc2626",
                fontSize: "14px",
                marginTop: "12px"
              }}>
                {taskError}
              </div>
            )}
          </div>
        )}

        {/* Add Task Form */}
        {showTaskForm && (
          <div style={{
            background: "#f9fafb",
            border: "2px solid #e5e7eb",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600 }}>Add New Task</h3>
            <form onSubmit={handleAddTask} style={{ display: "grid", gap: "16px" }}>
              <div className="form-field">
                <label style={labelStyle}>Task Title *</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  disabled={addingTask}
                  placeholder="What needs to be done?"
                  required
                  style={inputStyle}
                />
              </div>

              <div className="form-field">
                <label style={labelStyle}>Description</label>
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  disabled={addingTask}
                  rows={2}
                  placeholder="Additional details or instructions..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-field">
                  <label style={labelStyle}>Assign To</label>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    disabled={addingTask}
                    style={inputStyle}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field" style={{ display: "flex", alignItems: "center", paddingTop: "28px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newTaskCritical}
                      onChange={(e) => setNewTaskCritical(e.target.checked)}
                      disabled={addingTask}
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span style={{ fontWeight: 500 }}>Critical Task</span>
                  </label>
                </div>
              </div>

              {taskError && (
                <div style={{
                  padding: "12px 16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#dc2626",
                  fontSize: "14px",
                }}>
                  {taskError}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskForm(false);
                    setTaskError(null);
                    setNewTaskTitle("");
                    setNewTaskDescription("");
                    setNewTaskCritical(false);
                    setNewTaskAssignee("");
                  }}
                  disabled={addingTask}
                  className="action-button secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTask}
                  className="action-button success"
                >
                  {addingTask ? "Adding..." : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Task List */}
        {tasks.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#9ca3af",
            fontSize: "14px",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📋</div>
            <div>No tasks yet. Add tasks to define the work that needs to be done.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {tasks
              .sort((a, b) => (a.sequenceNumber || 999) - (b.sequenceNumber || 999))
              .map((task) => {
                const statusColor = getTaskStatusColor(task.status);
                return (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "16px",
                      padding: "16px",
                      background: "#f9fafb",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          {task.sequenceNumber && `${task.sequenceNumber}. `}
                          {task.title}
                        </span>
                        {task.isCritical && <span title="Critical">⚠️</span>}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: statusColor.bg,
                            color: statusColor.color,
                            textTransform: "uppercase",
                          }}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      {task.description && (
                        <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "6px" }}>
                          {task.description}
                        </div>
                      )}
                      {task.assignedTo && (
                        <div style={{ fontSize: "13px", color: "#6b7280" }}>
                          Assigned to: {task.assignedTo.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
