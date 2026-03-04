"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import "./standards-packs.css";

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

  const statusClass = (status: string) => {
    switch (status) {
      case "ACTIVE": return "active";
      case "DRAFT": return "draft";
      case "ARCHIVED": return "archived";
      default: return "";
    }
  };

  return (
    <div className="standards-packs-page">
      <div className="sp-page-header">
        <div className="sp-page-header-left">
          <h1>Standards Packs</h1>
          <p className="sp-page-subtitle">Reusable task templates for equipment types</p>
        </div>
        <button className="sp-btn-primary" onClick={() => setShowCreate(true)}>
          + New Pack
        </button>
      </div>

      {/* Filter */}
      <div className="sp-filter-bar">
        <select
          className="sp-filter-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {error && <div className="sp-alert-error">{error}</div>}

      {loading ? (
        <div className="sp-loading">Loading...</div>
      ) : packs.length === 0 ? (
        <div className="sp-empty">
          <p>No standards packs found.</p>
          <button className="sp-btn-primary" onClick={() => setShowCreate(true)}>
            Create your first pack
          </button>
        </div>
      ) : (
        <div className="sp-grid">
          {packs.map((pack) => (
            <Link href={`/standards-packs/${pack.id}`} key={pack.id} className="sp-pack-card">
              <div className="sp-pack-header">
                <h3 className="sp-pack-name">{pack.name}</h3>
                <span className={`sp-status-badge ${statusClass(pack.status)}`}>
                  {pack.status}
                </span>
              </div>
              {pack.description && (
                <p className="sp-pack-desc">{pack.description}</p>
              )}
              <div className="sp-pack-meta">
                {pack.equipmentType && (
                  <span className="sp-meta-tag">{pack.equipmentType}</span>
                )}
                <span className="sp-meta-tag">{pack._count.tasks} tasks</span>
                {pack.estimatedHours && (
                  <span className="sp-meta-tag">{pack.estimatedHours}h est.</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="sp-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h2>Create Standards Pack</h2>
            </div>
            <div className="sp-modal-body">
              <div className="sp-form-field">
                <label className="sp-form-label">Pack Name *</label>
                <input
                  className="sp-form-input"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Centrifugal Pump Overhaul"
                  autoFocus
                />
              </div>
              <div className="sp-form-field">
                <label className="sp-form-label">Equipment Type</label>
                <input
                  className="sp-form-input"
                  type="text"
                  value={createEquipType}
                  onChange={(e) => setCreateEquipType(e.target.value)}
                  placeholder="e.g., Centrifugal Pump"
                />
              </div>
              <div className="sp-form-field">
                <label className="sp-form-label">Description</label>
                <textarea
                  className="sp-form-textarea"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Describe when this pack should be used..."
                  rows={3}
                />
              </div>
            </div>
            <div className="sp-modal-footer">
              <button className="sp-btn-cancel" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="sp-btn-submit"
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
