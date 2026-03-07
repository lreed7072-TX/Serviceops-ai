"use client";

import { useState, useEffect } from "react";
import { MaterialCategory } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Material {
  id: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  unitCost: number | null;
  unit: string | null;
  category: MaterialCategory;
  isActive: boolean;
  _count?: {
    usages: number;
  };
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | "ALL">("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [pendingDeactivateId, setPendingDeactivateId] = useState<string | null>(null);
  const toast = useToast();

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    partNumber: string;
    manufacturer: string;
    unitCost: string;
    unit: string;
    category: MaterialCategory;
  }>({
    name: "",
    partNumber: "",
    manufacturer: "",
    unitCost: "",
    unit: "",
    category: MaterialCategory.PART,
  });

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (!showInactive) params.set("isActive", "true");

      const response = await fetch(`/api/materials?${params}`);
      if (response.ok) {
        const result = await response.json();
        setMaterials(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch materials:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [searchTerm, categoryFilter, showInactive]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      partNumber: formData.partNumber || null,
      manufacturer: formData.manufacturer || null,
      unitCost: formData.unitCost ? parseFloat(formData.unitCost) : null,
      unit: formData.unit || null,
      category: formData.category,
    };

    try {
      const url = editingId ? `/api/materials/${editingId}` : "/api/materials";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchMaterials();
        resetForm();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save material");
      }
    } catch (error) {
      console.error("Failed to save material:", error);
      toast.error("An error occurred while saving");
    }
  };

  const handleEdit = (material: Material) => {
    setEditingId(material.id);
    setFormData({
      name: material.name,
      partNumber: material.partNumber || "",
      manufacturer: material.manufacturer || "",
      unitCost: material.unitCost?.toString() || "",
      unit: material.unit || "",
      category: material.category,
    });
    setShowForm(true);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        await fetchMaterials();
      }
    } catch (error) {
      console.error("Failed to toggle material status:", error);
    }
  };

  const handleDelete = (id: string) => {
    setPendingDeactivateId(id);
    setShowDeactivateConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeactivateId) return;

    try {
      const response = await fetch(`/api/materials/${pendingDeactivateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchMaterials();
      }
    } catch (error) {
      console.error("Failed to delete material:", error);
    } finally {
      setShowDeactivateConfirm(false);
      setPendingDeactivateId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      partNumber: "",
      manufacturer: "",
      unitCost: "",
      unit: "",
      category: MaterialCategory.PART,
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Material Catalog</h1>
        <p className="text-gray-600">Manage reusable materials, parts, and consumables</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Search materials..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-3 py-2 w-64"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as MaterialCategory | "ALL")}
          className="border rounded px-3 py-2"
        >
          <option value="ALL">All Categories</option>
          <option value={MaterialCategory.PART}>Parts</option>
          <option value={MaterialCategory.CONSUMABLE}>Consumables</option>
          <option value={MaterialCategory.FLUID}>Fluids</option>
          <option value={MaterialCategory.OTHER}>Other</option>
        </select>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          <span>Show Inactive</span>
        </label>

        <button
          onClick={() => setShowForm(true)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add Material
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Edit Material" : "Add Material"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Part Number</label>
                <input
                  type="text"
                  value={formData.partNumber}
                  onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Unit Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="ea, ft, gal"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as MaterialCategory })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value={MaterialCategory.PART}>Part</option>
                  <option value={MaterialCategory.CONSUMABLE}>Consumable</option>
                  <option value={MaterialCategory.FLUID}>Fluid</option>
                  <option value={MaterialCategory.OTHER}>Other</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  {editingId ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Materials List */}
      {loading ? (
        <div className="text-center py-8">Loading materials...</div>
      ) : materials.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No materials found. Click "Add Material" to create one.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Part #</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Manufacturer</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Cost</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Usage</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {materials.map((material) => (
                <tr key={material.id} className={!material.isActive ? "bg-gray-50 opacity-60" : ""}>
                  <td className="px-4 py-3">{material.name}</td>
                  <td className="px-4 py-3 text-gray-600">{material.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{material.manufacturer || "—"}</td>
                  <td className="px-4 py-3">
                    {material.unitCost ? `$${Number(material.unitCost).toFixed(2)}${material.unit ? `/${material.unit}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded bg-gray-100">
                      {material.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {material._count?.usages || 0} times
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${
                      material.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}>
                      {material.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(material)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(material.id, material.isActive)}
                      className="text-orange-600 hover:underline text-sm"
                    >
                      {material.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={showDeactivateConfirm}
        onClose={() => { setShowDeactivateConfirm(false); setPendingDeactivateId(null); }}
        onConfirm={confirmDelete}
        title="Deactivate Material"
        message="Are you sure you want to deactivate this material?"
        detail="The material will be marked as inactive and hidden from default views."
        confirmLabel="Deactivate"
        variant="warning"
      />
    </div>
  );
}
