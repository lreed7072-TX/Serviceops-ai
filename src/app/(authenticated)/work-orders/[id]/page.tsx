"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TaskStatus, WorkPackageType, MaterialCategory } from "@prisma/client";

interface Material {
  id: string;
  materialId: string | null;
  name: string;
  partNumber: string | null;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  unit: string | null;
  notes: string | null;
  material?: {
    id: string;
    name: string;
    partNumber: string | null;
    category: MaterialCategory;
  } | null;
}

interface TaskInstance {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  sequenceNumber: number | null;
  assignedTo: { id: string; name: string; email: string } | null;
  timeEntries: Array<{ id: string; accumulatedSeconds: number; status: string }>;
  materialUsages: Material[];
  measurements: any[];
}

interface WorkPackage {
  id: string;
  type: WorkPackageType;
  tasks: TaskInstance[];
}

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  status: string;
  orderType: string;
  customer: { id: string; name: string; primaryPhone: string | null; primaryEmail: string | null };
  site: { id: string; name: string; address: string | null } | null;
  workPackages: WorkPackage[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalLaborHours: number;
    totalMaterialCost: number;
  };
}

interface CatalogMaterial {
  id: string;
  name: string;
  partNumber: string | null;
  unitCost: number | null;
  unit: string | null;
  category: MaterialCategory;
}

export default function WorkOrderDetailsPage() {
  const params = useParams();
  const workOrderId = params.id as string;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkPackageType | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  // Material dialog state
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [catalogMaterials, setCatalogMaterials] = useState<CatalogMaterial[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialForm, setMaterialForm] = useState({
    materialId: "",
    name: "",
    partNumber: "",
    quantity: "1",
    unitCost: "",
    unit: "",
    notes: "",
  });

  // Fetch work order
  const fetchWorkOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}`);
      if (response.ok) {
        const result = await response.json();
        setWorkOrder(result.data);
        // Set first work package as active tab
        if (result.data.workPackages.length > 0 && !activeTab) {
          setActiveTab(result.data.workPackages[0].type);
        }
      }
    } catch (error) {
      console.error("Failed to fetch work order:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch material catalog
  const fetchMaterials = async () => {
    try {
      const response = await fetch("/api/materials?isActive=true");
      if (response.ok) {
        const result = await response.json();
        setCatalogMaterials(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch materials:", error);
    }
  };

  useEffect(() => {
    fetchWorkOrder();
    fetchMaterials();
  }, [workOrderId]);

  // Toggle task expansion
  const toggleTask = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchWorkOrder(); // Refresh to get updated data
      }
    } catch (error) {
      console.error("Failed to update task status:", error);
    }
  };

  // Open material dialog
  const openMaterialDialog = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowMaterialDialog(true);
    setMaterialForm({
      materialId: "",
      name: "",
      partNumber: "",
      quantity: "1",
      unitCost: "",
      unit: "",
      notes: "",
    });
    setMaterialSearch("");
  };

  // Select material from catalog
  const selectCatalogMaterial = (material: CatalogMaterial) => {
    setMaterialForm({
      materialId: material.id,
      name: material.name,
      partNumber: material.partNumber || "",
      quantity: "1",
      unitCost: material.unitCost?.toString() || "",
      unit: material.unit || "",
      notes: "",
    });
    setMaterialSearch("");
  };

  // Add material to task
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    const payload = {
      taskInstanceId: selectedTaskId,
      materialId: materialForm.materialId || null,
      name: materialForm.name,
      partNumber: materialForm.partNumber || null,
      quantity: parseFloat(materialForm.quantity),
      unitCost: materialForm.unitCost ? parseFloat(materialForm.unitCost) : null,
      unit: materialForm.unit || null,
      notes: materialForm.notes || null,
    };

    try {
      const response = await fetch("/api/task-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowMaterialDialog(false);
        await fetchWorkOrder(); // Refresh to show new material
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add material");
      }
    } catch (error) {
      console.error("Failed to add material:", error);
    }
  };

  // Delete material
  const deleteMaterial = async (materialId: string) => {
    if (!confirm("Remove this material from the task?")) return;

    try {
      const response = await fetch(`/api/task-materials/${materialId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchWorkOrder(); // Refresh
      }
    } catch (error) {
      console.error("Failed to delete material:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  if (loading) {
    return <div className="work-order-details"><div className="analytics-loading-content">Loading work order...</div></div>;
  }

  if (!workOrder) {
    return <div className="work-order-details"><div className="analytics-loading-content">Work order not found</div></div>;
  }

  const activePackage = workOrder.workPackages.find((pkg) => pkg.type === activeTab);
  const filteredMaterials = catalogMaterials.filter((m) =>
    m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
    (m.partNumber && m.partNumber.toLowerCase().includes(materialSearch.toLowerCase()))
  );

  const getStatusClass = () => {
    if (workOrder.status === "COMPLETED") return "completed";
    if (workOrder.status === "IN_PROGRESS") return "in-progress";
    return "open";
  };

  return (
    <div className="work-order-details">
      {/* Header */}
      <div className="work-order-header">
        <h1>{workOrder.workOrderNumber}</h1>
        <div className="work-order-meta">
          <div><strong>Customer:</strong> {workOrder.customer.name}</div>
          <div><strong>Site:</strong> {workOrder.site?.name || "N/A"}</div>
          <div>
            <strong>Status:</strong>{" "}
            <span className={`work-order-status-badge ${getStatusClass()}`}>
              {workOrder.status}
            </span>
          </div>
          <div>
            <strong>Progress:</strong> {workOrder.summary.completedTasks}/{workOrder.summary.totalTasks} tasks ({workOrder.summary.completionRate.toFixed(0)}%)
          </div>
        </div>
      </div>

      {/* Work Package Tabs */}
      <div className="work-package-tabs">
        {workOrder.workPackages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setActiveTab(pkg.type)}
            className={`work-package-tab ${activeTab === pkg.type ? "active" : ""}`}
          >
            {pkg.type === "MECH_ELEC_UNIFIED" ? "Unified" : pkg.type.charAt(0) + pkg.type.slice(1).toLowerCase()}
            <span className="work-package-tab-count">
              ({pkg.tasks.filter((t) => t.status === "DONE").length}/{pkg.tasks.length})
            </span>
          </button>
        ))}
      </div>

      {/* Task List */}
      {activePackage && (
        <div className="task-list">
          {activePackage.tasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id);
            const totalLaborSeconds = task.timeEntries.reduce((sum, entry) => sum + entry.accumulatedSeconds, 0);
            const totalMaterialCost = task.materialUsages.reduce((sum, mat) => sum + (mat.totalCost || 0), 0);

            return (
              <div key={task.id} className={`task-card ${task.status === "DONE" ? "completed" : ""}`}>
                {/* Task Header */}
                <div className="task-header">
                  <div className="task-title-group">
                    <input
                      type="checkbox"
                      checked={task.status === "DONE"}
                      onChange={(e) => updateTaskStatus(task.id, e.target.checked ? "DONE" : "TODO")}
                      className="task-checkbox"
                    />
                    <div>
                      <div className="task-title">{task.title}</div>
                      {task.description && <div className="task-description">{task.description}</div>}
                    </div>
                  </div>
                  <div className="task-badges">
                    {totalLaborSeconds > 0 && (
                      <span className="task-badge">
                        ⏱️ {Math.round(totalLaborSeconds / 60)}m
                      </span>
                    )}
                    {totalMaterialCost > 0 && (
                      <span className="task-badge">
                        💵 {formatCurrency(totalMaterialCost)}
                      </span>
                    )}
                    <button onClick={() => toggleTask(task.id)} className="task-expand-btn">
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="task-details">
                    {/* Materials Section */}
                    <div className="task-section">
                      <div className="task-section-header">
                        <h4 className="task-section-title">📦 Materials</h4>
                        <button onClick={() => openMaterialDialog(task.id)} className="task-section-action">
                          + Add Material
                        </button>
                      </div>

                      {task.materialUsages.length === 0 ? (
                        <div className="material-empty">No materials added yet</div>
                      ) : (
                        <div className="material-list">
                          {task.materialUsages.map((material) => (
                            <div key={material.id} className="material-item">
                              <div className="material-info">
                                <div className="material-name">{material.name}</div>
                                {material.partNumber && (
                                  <div className="material-part-number">P/N: {material.partNumber}</div>
                                )}
                                <div className="material-quantity">
                                  Qty: {material.quantity} {material.unit || "ea"} × {material.unitCost ? formatCurrency(material.unitCost) : "$0.00"}
                                </div>
                                {material.notes && <div className="material-notes">{material.notes}</div>}
                              </div>
                              <div className="material-actions">
                                <span className="material-cost">
                                  {formatCurrency(material.totalCost || 0)}
                                </span>
                                <button onClick={() => deleteMaterial(material.id)} className="material-remove-btn">
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Material Dialog */}
      {showMaterialDialog && (
        <div className="material-dialog-overlay" onClick={() => setShowMaterialDialog(false)}>
          <div className="material-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Add Material</h2>

            {/* Material Search */}
            <div className="material-search-group">
              <label className="material-search-label">Search Catalog</label>
              <input
                type="text"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder="Search by name or part number..."
                className="material-search-input"
              />

              {materialSearch && filteredMaterials.length > 0 && (
                <div className="material-search-results">
                  {filteredMaterials.slice(0, 10).map((mat) => (
                    <div
                      key={mat.id}
                      onClick={() => selectCatalogMaterial(mat)}
                      className={`material-search-item ${materialForm.materialId === mat.id ? "selected" : ""}`}
                    >
                      <div className="material-search-item-name">{mat.name}</div>
                      {mat.partNumber && <div className="material-search-item-meta">P/N: {mat.partNumber}</div>}
                      <div className="material-search-item-meta">
                        {mat.unitCost ? formatCurrency(mat.unitCost) : "No cost"} {mat.unit && `per ${mat.unit}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Material Form */}
            <form onSubmit={handleAddMaterial} className="material-form">
              <div className="material-form-field">
                <label className="material-form-label required">Material Name</label>
                <input
                  type="text"
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  required
                  className="material-form-input"
                />
              </div>

              <div className="material-form-field">
                <label className="material-form-label">Part Number</label>
                <input
                  type="text"
                  value={materialForm.partNumber}
                  onChange={(e) => setMaterialForm({ ...materialForm, partNumber: e.target.value })}
                  className="material-form-input"
                />
              </div>

              <div className="material-form-row">
                <div className="material-form-field">
                  <label className="material-form-label required">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialForm.quantity}
                    onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                    required
                    className="material-form-input"
                  />
                </div>

                <div className="material-form-field">
                  <label className="material-form-label">Unit Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialForm.unitCost}
                    onChange={(e) => setMaterialForm({ ...materialForm, unitCost: e.target.value })}
                    className="material-form-input"
                  />
                </div>

                <div className="material-form-field">
                  <label className="material-form-label">Unit</label>
                  <input
                    type="text"
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    placeholder="ea, ft, gal..."
                    className="material-form-input"
                  />
                </div>
              </div>

              <div className="material-form-field">
                <label className="material-form-label">Notes</label>
                <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  rows={3}
                  className="material-form-textarea"
                />
              </div>

              {/* Total Preview */}
              {materialForm.quantity && materialForm.unitCost && (
                <div className="material-total-preview">
                  Total: {formatCurrency(parseFloat(materialForm.quantity) * parseFloat(materialForm.unitCost))}
                </div>
              )}

              <div className="material-form-actions">
                <button type="button" onClick={() => setShowMaterialDialog(false)} className="material-cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="material-submit-btn">
                  Add Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
