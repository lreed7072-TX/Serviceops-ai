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
  customer: { id: string; name: string; phone: string | null; email: string | null };
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
    return <div style={{ padding: "20px" }}>Loading work order...</div>;
  }

  if (!workOrder) {
    return <div style={{ padding: "20px" }}>Work order not found</div>;
  }

  const activePackage = workOrder.workPackages.find((pkg) => pkg.type === activeTab);
  const filteredMaterials = catalogMaterials.filter((m) =>
    m.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
    (m.partNumber && m.partNumber.toLowerCase().includes(materialSearch.toLowerCase()))
  );

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px", borderBottom: "2px solid #e5e7eb", paddingBottom: "20px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "10px" }}>
          {workOrder.workOrderNumber}
        </h1>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", color: "#6b7280" }}>
          <div><strong>Customer:</strong> {workOrder.customer.name}</div>
          <div><strong>Site:</strong> {workOrder.site?.name || "N/A"}</div>
          <div><strong>Status:</strong> <span style={{ 
            padding: "2px 8px", 
            borderRadius: "4px", 
            background: workOrder.status === "COMPLETED" ? "#d1fae5" : "#fef3c7",
            color: workOrder.status === "COMPLETED" ? "#065f46" : "#92400e"
          }}>{workOrder.status}</span></div>
          <div><strong>Progress:</strong> {workOrder.summary.completedTasks}/{workOrder.summary.totalTasks} tasks ({workOrder.summary.completionRate.toFixed(0)}%)</div>
        </div>
      </div>

      {/* Work Package Tabs */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px", borderBottom: "1px solid #e5e7eb" }}>
        {workOrder.workPackages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setActiveTab(pkg.type)}
            style={{
              padding: "10px 20px",
              border: "none",
              borderBottom: activeTab === pkg.type ? "3px solid #3b82f6" : "3px solid transparent",
              background: "none",
              cursor: "pointer",
              fontWeight: activeTab === pkg.type ? "600" : "normal",
              color: activeTab === pkg.type ? "#3b82f6" : "#6b7280",
            }}
          >
            {pkg.type === "MECH_ELEC_UNIFIED" ? "Unified" : pkg.type.charAt(0) + pkg.type.slice(1).toLowerCase()}
            <span style={{ marginLeft: "8px", fontSize: "12px", color: "#9ca3af" }}>
              ({pkg.tasks.filter((t) => t.status === "DONE").length}/{pkg.tasks.length})
            </span>
          </button>
        ))}
      </div>

      {/* Task List */}
      {activePackage && (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {activePackage.tasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id);
            const totalLaborSeconds = task.timeEntries.reduce((sum, entry) => sum + entry.accumulatedSeconds, 0);
            const totalMaterialCost = task.materialUsages.reduce((sum, mat) => sum + (mat.totalCost || 0), 0);

            return (
              <div
                key={task.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "15px",
                  background: task.status === "DONE" ? "#f0fdf4" : "#fff",
                }}
              >
                {/* Task Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={task.status === "DONE"}
                      onChange={(e) => updateTaskStatus(task.id, e.target.checked ? "DONE" : "TODO")}
                      style={{ width: "18px", height: "18px", cursor: "pointer" }}
                    />
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "16px" }}>{task.title}</div>
                      {task.description && <div style={{ fontSize: "14px", color: "#6b7280" }}>{task.description}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    {totalLaborSeconds > 0 && (
                      <span style={{ fontSize: "14px", color: "#6b7280" }}>
                        ⏱️ {Math.round(totalLaborSeconds / 60)}m
                      </span>
                    )}
                    {totalMaterialCost > 0 && (
                      <span style={{ fontSize: "14px", color: "#6b7280" }}>
                        💵 {formatCurrency(totalMaterialCost)}
                      </span>
                    )}
                    <button
                      onClick={() => toggleTask(task.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px" }}
                    >
                      {isExpanded ? "▼" : "▶"}
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #e5e7eb" }}>
                    {/* Materials Section */}
                    <div style={{ marginBottom: "15px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>📦 Materials</h4>
                        <button
                          onClick={() => openMaterialDialog(task.id)}
                          style={{
                            padding: "6px 12px",
                            background: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "13px",
                          }}
                        >
                          + Add Material
                        </button>
                      </div>

                      {task.materialUsages.length === 0 ? (
                        <div style={{ padding: "10px", background: "#f9fafb", borderRadius: "4px", fontSize: "13px", color: "#6b7280" }}>
                          No materials added yet
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {task.materialUsages.map((material) => (
                            <div
                              key={material.id}
                              style={{
                                padding: "10px",
                                background: "#f9fafb",
                                borderRadius: "4px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: "600", fontSize: "14px" }}>{material.name}</div>
                                {material.partNumber && (
                                  <div style={{ fontSize: "12px", color: "#6b7280" }}>P/N: {material.partNumber}</div>
                                )}
                                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                  Qty: {material.quantity} {material.unit || "ea"} × {material.unitCost ? formatCurrency(material.unitCost) : "$0.00"}
                                </div>
                                {material.notes && <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>{material.notes}</div>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontWeight: "600", fontSize: "15px" }}>
                                  {formatCurrency(material.totalCost || 0)}
                                </span>
                                <button
                                  onClick={() => deleteMaterial(material.id)}
                                  style={{
                                    background: "#ef4444",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowMaterialDialog(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "8px",
              padding: "30px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: "20px", fontSize: "20px", fontWeight: "bold" }}>Add Material</h2>

            {/* Material Search */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                Search Catalog
              </label>
              <input
                type="text"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder="Search by name or part number..."
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              />

              {materialSearch && filteredMaterials.length > 0 && (
                <div style={{
                  marginTop: "10px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  maxHeight: "200px",
                  overflow: "auto",
                }}>
                  {filteredMaterials.slice(0, 10).map((mat) => (
                    <div
                      key={mat.id}
                      onClick={() => selectCatalogMaterial(mat)}
                      style={{
                        padding: "10px",
                        borderBottom: "1px solid #e5e7eb",
                        cursor: "pointer",
                        background: materialForm.materialId === mat.id ? "#eff6ff" : "white",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = materialForm.materialId === mat.id ? "#eff6ff" : "white"; }}
                    >
                      <div style={{ fontWeight: "600", fontSize: "14px" }}>{mat.name}</div>
                      {mat.partNumber && <div style={{ fontSize: "12px", color: "#6b7280" }}>P/N: {mat.partNumber}</div>}
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        {mat.unitCost ? formatCurrency(mat.unitCost) : "No cost"} {mat.unit && `per ${mat.unit}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Material Form */}
            <form onSubmit={handleAddMaterial}>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                  Material Name *
                </label>
                <input
                  type="text"
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                  Part Number
                </label>
                <input
                  type="text"
                  value={materialForm.partNumber}
                  onChange={(e) => setMaterialForm({ ...materialForm, partNumber: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialForm.quantity}
                    onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                    Unit Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={materialForm.unitCost}
                    onChange={(e) => setMaterialForm({ ...materialForm, unitCost: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    placeholder="ea, ft, gal..."
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px", fontWeight: "500" }}>
                  Notes
                </label>
                <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm({ ...materialForm, notes: e.target.value })}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "14px",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Total Preview */}
              {materialForm.quantity && materialForm.unitCost && (
                <div style={{
                  padding: "10px",
                  background: "#f0f9ff",
                  borderRadius: "4px",
                  marginBottom: "20px",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#0369a1",
                }}>
                  Total: {formatCurrency(parseFloat(materialForm.quantity) * parseFloat(materialForm.unitCost))}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowMaterialDialog(false)}
                  style={{
                    padding: "10px 20px",
                    background: "#e5e7eb",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                  }}
                >
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
