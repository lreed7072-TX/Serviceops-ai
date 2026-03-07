"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import "./materials.css";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  const deleteMaterial = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteMaterial = async () => {
    if (!pendingDeleteId) return;
    try {
      const res = await apiFetch(`/api/materials/${pendingDeleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await loadMaterials();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    } finally {
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="materials-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Materials Catalog</h1>
          <p className="page-subtitle">Parts and materials for work orders</p>
        </div>
        <div className="page-header-right">
          <Link href="/materials/duplicates" className="btn-secondary">
            Find Duplicates
          </Link>
          <button className="btn-primary" onClick={openCreate}>+ Add Material</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="materials-filter-bar">
        <label className="materials-checkbox-label">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {/* Error Alert */}
      {error && <div className="alert-error">{error}</div>}

      {/* Content */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading materials...</span>
        </div>
      ) : materials.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Package size={32} /></div>
          <h3>No materials found</h3>
          <p>Add your first material to get started</p>
          <button className="btn-primary" onClick={openCreate}>+ Add Material</button>
        </div>
      ) : (
        <div className="materials-table-container">
          <table className="materials-table">
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
                  <td><span className="material-name">{m.name}</span></td>
                  <td>{m.partNumber || "—"}</td>
                  <td>{m.manufacturer || "—"}</td>
                  <td>{m.unitCost ? `$${Number(m.unitCost).toFixed(2)}` : "—"}</td>
                  <td>{m.unit || "—"}</td>
                  <td><span className={`category-badge ${m.category.toLowerCase()}`}>{m.category}</span></td>
                  <td>
                    <div className="materials-actions">
                      <button className="btn-icon" onClick={() => openEdit(m)}><Pencil size={14} /></button>
                      <button className="btn-icon danger" onClick={() => deleteMaterial(m.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? "Edit Material" : "Add Material"}</h2>
            </div>
            <div className="modal-body">
              <div className="materials-form-grid">
                <div className="form-field">
                  <label className="field-label">Name *</label>
                  <input type="text" className="field-input" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Material name" />
                </div>
                <div className="form-field">
                  <label className="field-label">Part Number</label>
                  <input type="text" className="field-input" value={formPartNumber} onChange={(e) => setFormPartNumber(e.target.value)} placeholder="Part #" />
                </div>
                <div className="form-field">
                  <label className="field-label">Manufacturer</label>
                  <input type="text" className="field-input" value={formManufacturer} onChange={(e) => setFormManufacturer(e.target.value)} placeholder="Manufacturer" />
                </div>
                <div className="form-field">
                  <label className="field-label">Category</label>
                  <select className="field-select" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label className="field-label">Unit Cost ($)</label>
                  <input type="number" step="0.01" className="field-input" value={formUnitCost} onChange={(e) => setFormUnitCost(e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-field">
                  <label className="field-label">Unit</label>
                  <input type="text" className="field-input" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} placeholder="each, ft, gal" />
                </div>
                <div className="form-field">
                  <label className="materials-checkbox-label">
                    <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="btn-submit" onClick={saveMaterial} disabled={!formName.trim() || saving}>
                {saving ? "Saving..." : editing ? "Update" : "Add Material"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setPendingDeleteId(null); }}
        onConfirm={confirmDeleteMaterial}
        title="Delete Material"
        message="Delete this material?"
        detail="This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
