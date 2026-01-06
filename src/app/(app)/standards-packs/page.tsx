"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type StandardsPack = {
  id: string;
  name: string;
  description: string | null;
  equipmentType: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  estimatedHours: number | null;
  _count: { tasks: number };
};

export default function StandardsPacksPage() {
  const [packs, setPacks] = useState<StandardsPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createEquipType, setCreateEquipType] = useState("");
  const [creating, setCreating] = useState(false);

  const loadPacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = filter === "ALL" 
        ? "/api/standards-packs" 
        : `/api/standards-packs?status=${filter}`;
      const res = await apiFetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load packs");
      const json = await res.json();
      setPacks(json.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPacks();
  }, [filter]);

  const createPack = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch("/api/standards-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || null,
          equipmentType: createEquipType.trim() || null,
          status: "DRAFT",
        }),
      });
      if (!res.ok) throw new Error("Failed to create pack");
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setCreateEquipType("");
      await loadPacks();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "status-active";
      case "DRAFT": return "status-draft";
      case "ARCHIVED": return "status-archived";
      default: return "";
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Standards Packs</h1>
          <p className="page-subtitle">Reusable task templates for equipment types</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Pack
        </button>
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : packs.length === 0 ? (
        <div className="empty-state">
          <p>No standards packs found.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            Create your first pack
          </button>
        </div>
      ) : (
        <div className="card-grid">
          {packs.map((pack) => (
            <Link href={`/standards-packs/${pack.id}`} key={pack.id} className="pack-card">
              <div className="pack-card-header">
                <h3>{pack.name}</h3>
                <span className={`status-badge ${statusColor(pack.status)}`}>
                  {pack.status}
                </span>
              </div>
              {pack.description && (
                <p className="pack-description">{pack.description}</p>
              )}
              <div className="pack-meta">
                {pack.equipmentType && (
                  <span className="pack-equipment">{pack.equipmentType}</span>
                )}
                <span className="pack-tasks">{pack._count.tasks} tasks</span>
                {pack.estimatedHours && (
                  <span className="pack-hours">{pack.estimatedHours}h est.</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Standards Pack</h2>
            <div className="form-field">
              <label>Pack Name *</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g., Centrifugal Pump Overhaul"
                autoFocus
              />
            </div>
            <div className="form-field">
              <label>Equipment Type</label>
              <input
                type="text"
                value={createEquipType}
                onChange={(e) => setCreateEquipType(e.target.value)}
                placeholder="e.g., Centrifugal Pump"
              />
            </div>
            <div className="form-field">
              <label>Description</label>
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Describe when this pack should be used..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createPack}
                disabled={!createName.trim() || creating}
              >
                {creating ? "Creating..." : "Create Pack"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
