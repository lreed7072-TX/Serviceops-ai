"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Material = {
  id: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  unitCost: number | null;
  unit: string | null;
  category: "PART" | "CONSUMABLE" | "FLUID" | "OTHER";
  isActive: boolean;
};

const CATEGORIES = [
  { value: "PART", label: "Part" },
  { value: "CONSUMABLE", label: "Consumable" },
  { value: "FLUID", label: "Fluid" },
  { value: "OTHER", label: "Other" },
];

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPartNumber, setFormPartNumber] = useState("");
  const [formManufacturer, setFormManufacturer] = useState("");
  const [formUnitCost, setFormUnitCost] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formCategory, setFormCategory] = useState("PART");
  const [formActive, setFormActive] = useState(true);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/materials?active=${!showInactive}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setMaterials(json.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMaterials(); }, [showInactive]);

  const resetForm = () => {
    setFormName(""); setFormPartNumber(""); setFormManufacturer("");
    setFormUnitCost(""); setFormUnit(""); setFormCategory("PART"); setFormActive(true);
  };

  const openCreate = () => { resetForm(); setEditing(null); setShowModal(true); };

  const openEdit = (m: Material) => {
    setEditing(m);
    setFormName(m.name);
    setFormPartNumber(m.partNumber ?? "");
    setFormManufacturer(m.manufacturer ?? "");
    setFormUnitCost(m.unitCost?.toString() ?? "");
    setFormUnit(m.unit ?? "");
    setFormCategory(m.category);
    setFormActive(m.isActive);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); resetForm(); };

  const saveMaterial = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        partNumber: formPartNumber.trim() || null,
        manufacturer: formManufacturer.trim() || null,
        unitCost: formUnitCost ? parseFloat(formUnitCost) : null,
        unit: formUnit.trim() || null,
        category: formCategory,
        isActive: formActive,
      };
      const url = editing ? `/api/materials/${editing.id}` : "/api/materials";
      const method = editing ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      closeModal();
      await loadMaterials();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    try {
      const res = await apiFetch(`/api/materials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await loadMaterials();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Materials Catalog</h1>
          <p className="page-subtitle">Parts and materials for work orders</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Material</button>
      </div>

      <div className="filter-bar">
        <label className="checkbox-label">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : materials.length === 0 ? (
        <div className="empty-state">
          <p>No materials found.</p>
          <button className="btn btn-primary" onClick={openCreate}>Add your first material</button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Part #</th>
                <th>Manufacturer</th>
                <th>Unit Cost</th>
                <th>Unit</th>
                <th>Category</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className={!m.isActive ? "inactive-row" : ""}>
                  <td><strong>{m.name}</strong></td>
                  <td>{m.partNumber || "—"}</td>
                  <td>{m.manufacturer || "—"}</td>
                  <td>{m.unitCost ? `$${m.unitCost.toFixed(2)}` : "—"}</td>
                  <td>{m.unit || "—"}</td>
                  <td><span className={`badge ${m.category.toLowerCase()}`}>{m.category}</span></td>
                  <td>
                    <button className="btn-icon" onClick={() => openEdit(m)}>✏️</button>
                    <button className="btn-icon danger" onClick={() => deleteMaterial(m.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Edit Material" : "Add Material"}</h2>
            <div className="form-grid">
              <div className="form-field">
                <label>Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Material name" />
              </div>
              <div className="form-field">
                <label>Part Number</label>
                <input type="text" value={formPartNumber} onChange={(e) => setFormPartNumber(e.target.value)} placeholder="Part #" />
              </div>
              <div className="form-field">
                <label>Manufacturer</label>
                <input type="text" value={formManufacturer} onChange={(e) => setFormManufacturer(e.target.value)} placeholder="Manufacturer" />
              </div>
              <div className="form-field">
                <label>Category</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Unit Cost ($)</label>
                <input type="number" step="0.01" value={formUnitCost} onChange={(e) => setFormUnitCost(e.target.value)} placeholder="0.00" />
              </div>
              <div className="form-field">
                <label>Unit</label>
                <input type="text" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="each, ft, gal" />
              </div>
              <div className="form-field">
                <label className="checkbox-label">
                  <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMaterial} disabled={!formName.trim() || saving}>
                {saving ? "Saving..." : editing ? "Update" : "Add Material"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
