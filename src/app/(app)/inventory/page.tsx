"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StockMovementType } from "@prisma/client";
import { useToast } from "@/components/ui/Toast";

interface Material {
  id: string;
  name: string;
  partNumber: string | null;
  category: string;
  quantityOnHand: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  unit: string | null;
  unitCost: number | null;
  location: string | null;
  lastRestocked: string | null;
}

interface LowStockMaterial extends Material {
  shortfall: number;
  percentOfMin: number;
}

interface StockMovementForm {
  movementType: StockMovementType;
  quantity: number;
  unitCost: number;
  reference: string;
  notes: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [lowStockMaterials, setLowStockMaterials] = useState<LowStockMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [stockMovement, setStockMovement] = useState<StockMovementForm>({
    movementType: StockMovementType.PURCHASE,
    quantity: 0,
    unitCost: 0,
    reference: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [materialsRes, lowStockRes] = await Promise.all([
        fetch("/api/materials"),
        fetch("/api/inventory/low-stock"),
      ]);

      if (materialsRes.ok) {
        const result = await materialsRes.json();
        setMaterials(result.data || []);
      }

      if (lowStockRes.ok) {
        const result = await lowStockRes.json();
        setLowStockMaterials(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch inventory data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openStockModal = (material: Material) => {
    setSelectedMaterial(material);
    setStockMovement({
      movementType: StockMovementType.PURCHASE,
      quantity: 0,
      unitCost: material.unitCost || 0,
      reference: "",
      notes: "",
    });
    setShowStockModal(true);
  };

  const handleStockMovement = async () => {
    if (!selectedMaterial) return;

    if (stockMovement.quantity <= 0) {
      toast.warning("Please enter a valid quantity");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/stock-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: selectedMaterial.id,
          ...stockMovement,
        }),
      });

      if (response.ok) {
        toast.success("Stock movement recorded successfully");
        setShowStockModal(false);
        fetchData(); // Refresh data
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to record stock movement");
      }
    } catch (error) {
      console.error("Failed to record stock movement:", error);
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const getStockStatus = (material: Material) => {
    if (!material.minQuantity) return "text-gray-600";
    
    const onHand = material.quantityOnHand;
    const min = material.minQuantity;
    
    if (onHand === 0) return "text-red-600 font-bold";
    if (onHand < min) return "text-orange-600 font-semibold";
    return "text-green-600";
  };

  if (loading) {
    return <div className="p-6">Loading inventory...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Inventory Management</h1>
        <p className="text-gray-600">Track and manage material stock levels</p>
      </div>

      {/* Low Stock Alerts */}
      {lowStockMaterials.length > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-orange-800">
              ⚠️ Low Stock Alerts ({lowStockMaterials.length})
            </h2>
          </div>
          <div className="space-y-2">
            {lowStockMaterials.slice(0, 5).map((material) => (
              <div key={material.id} className="flex items-center justify-between bg-white p-3 rounded">
                <div>
                  <div className="font-medium">{material.name}</div>
                  {material.partNumber && (
                    <div className="text-sm text-gray-600">PN: {material.partNumber}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-orange-600 font-semibold">
                    {material.quantityOnHand} {material.unit || "units"}
                  </div>
                  <div className="text-sm text-gray-600">
                    Min: {material.minQuantity} (need {material.shortfall.toFixed(2)} more)
                  </div>
                </div>
                <button
                  onClick={() => openStockModal(material)}
                  className="ml-4 bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                >
                  Restock
                </button>
              </div>
            ))}
          </div>
          {lowStockMaterials.length > 5 && (
            <div className="mt-3 text-sm text-orange-700">
              ...and {lowStockMaterials.length - 5} more
            </div>
          )}
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">All Materials</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Material</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
              <th className="px-4 py-3 text-right text-sm font-medium">On Hand</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Min/Max</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Last Restocked</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {materials.map((material) => (
              <tr key={material.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{material.name}</div>
                  {material.partNumber && (
                    <div className="text-sm text-gray-600">PN: {material.partNumber}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded bg-gray-100">
                    {material.category}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right ${getStockStatus(material)}`}>
                  {material.quantityOnHand} {material.unit || "units"}
                </td>
                <td className="px-4 py-3 text-right text-sm">
                  {material.minQuantity ? (
                    <div>
                      <div>Min: {material.minQuantity}</div>
                      {material.maxQuantity && <div>Max: {material.maxQuantity}</div>}
                    </div>
                  ) : (
                    <span className="text-gray-400">Not set</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {material.location || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  {material.lastRestocked ? (
                    new Date(material.lastRestocked).toLocaleDateString()
                  ) : (
                    <span className="text-gray-400">Never</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openStockModal(material)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Adjust Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stock Movement Modal */}
      {showStockModal && selectedMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Adjust Stock: {selectedMaterial.name}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">Current Stock</div>
              <div className="text-2xl font-bold">
                {selectedMaterial.quantityOnHand} {selectedMaterial.unit || "units"}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Movement Type</label>
                <select
                  value={stockMovement.movementType}
                  onChange={(e) => setStockMovement({ 
                    ...stockMovement, 
                    movementType: e.target.value as StockMovementType 
                  })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value={StockMovementType.PURCHASE}>Purchase (Add Stock)</option>
                  <option value={StockMovementType.ADJUSTMENT}>Adjustment</option>
                  <option value={StockMovementType.RETURN}>Return to Stock</option>
                  <option value={StockMovementType.USAGE}>Usage (Remove Stock)</option>
                  <option value={StockMovementType.WRITE_OFF}>Write Off</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stockMovement.quantity}
                  onChange={(e) => setStockMovement({ 
                    ...stockMovement, 
                    quantity: parseFloat(e.target.value) || 0 
                  })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter quantity"
                />
              </div>

              {stockMovement.movementType === StockMovementType.PURCHASE && (
                <div>
                  <label className="block text-sm font-medium mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={stockMovement.unitCost}
                    onChange={(e) => setStockMovement({ 
                      ...stockMovement, 
                      unitCost: parseFloat(e.target.value) || 0 
                    })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Reference</label>
                <input
                  type="text"
                  value={stockMovement.reference}
                  onChange={(e) => setStockMovement({ 
                    ...stockMovement, 
                    reference: e.target.value 
                  })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="PO#, WO#, or other reference"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={stockMovement.notes}
                  onChange={(e) => setStockMovement({ 
                    ...stockMovement, 
                    notes: e.target.value 
                  })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleStockMovement}
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Recording..." : "Record Movement"}
              </button>
              <button
                onClick={() => setShowStockModal(false)}
                className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
