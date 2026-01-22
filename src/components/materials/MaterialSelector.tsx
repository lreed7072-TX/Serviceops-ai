"use client";

import { useState, useEffect } from "react";
import { MaterialCategory } from "@prisma/client";

interface Material {
  id: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  unitCost: number | null;
  unit: string | null;
  category: MaterialCategory;
}

interface MaterialSelectorProps {
  onSelect: (material: Material) => void;
  onCancel: () => void;
  showModal?: boolean;
}

export default function MaterialSelector({ onSelect, onCancel, showModal = true }: MaterialSelectorProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | "ALL">("ALL");

  useEffect(() => {
    fetchMaterials();
  }, [searchTerm, categoryFilter]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      params.set("isActive", "true"); // Only show active materials

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

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold mb-3">Select from Catalog</h3>
        
        {/* Search and Filter */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoFocus
          />
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as MaterialCategory | "ALL")}
            className="w-full border rounded px-3 py-2"
          >
            <option value="ALL">All Categories</option>
            <option value={MaterialCategory.PART}>Parts</option>
            <option value={MaterialCategory.CONSUMABLE}>Consumables</option>
            <option value={MaterialCategory.FLUID}>Fluids</option>
            <option value={MaterialCategory.OTHER}>Other</option>
          </select>
        </div>
      </div>

      {/* Materials List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading materials...</div>
        ) : materials.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No materials found. Try adjusting your search.
          </div>
        ) : (
          <div className="divide-y">
            {materials.map((material) => (
              <button
                key={material.id}
                onClick={() => onSelect(material)}
                className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium">{material.name}</div>
                {material.partNumber && (
                  <div className="text-sm text-gray-600">P/N: {material.partNumber}</div>
                )}
                {material.manufacturer && (
                  <div className="text-sm text-gray-600">{material.manufacturer}</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100">
                    {material.category}
                  </span>
                  {material.unitCost && (
                    <span className="text-sm font-medium text-green-700">
                      ${Number(material.unitCost).toFixed(2)}{material.unit ? `/${material.unit}` : ""}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <button
          onClick={onCancel}
          className="w-full bg-gray-200 py-2 rounded hover:bg-gray-300 transition-colors"
        >
          Cancel / Enter Manually
        </button>
      </div>
    </div>
  );

  if (!showModal) {
    return content;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        {content}
      </div>
    </div>
  );
}
