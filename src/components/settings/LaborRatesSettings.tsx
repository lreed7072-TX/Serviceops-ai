"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import "./LaborRatesSettings.css";

interface LaborRate {
  id: string;
  name: string;
  description: string | null;
  hourlyRate: number;
  isDefault: boolean;
}

export default function LaborRatesSettings() {
  const [loading, setLoading] = useState(true);
  const [laborRates, setLaborRates] = useState<LaborRate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<LaborRate | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      const res = await apiFetch("/api/settings/labor-rates");
      if (res.ok) {
        const json = await res.json();
        setLaborRates(json.data || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const openAddModal = () => {
    setEditingRate(null);
    setName("");
    setDescription("");
    setHourlyRate("");
    setIsDefault(false);
    setShowModal(true);
  };

  const openEditModal = (rate: LaborRate) => {
    setEditingRate(rate);
    setName(rate.name);
    setDescription(rate.description || "");
    setHourlyRate(String(rate.hourlyRate));
    setIsDefault(rate.isDefault);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!name.trim() || !hourlyRate) {
      setMessage({ type: "error", text: "Name and hourly rate are required" });
      return;
    }

    const rate = parseFloat(hourlyRate);
    if (rate <= 0) {
      setMessage({ type: "error", text: "Hourly rate must be greater than 0" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        hourlyRate: rate,
        isDefault,
      };

      const url = editingRate
        ? `/api/settings/labor-rates/${editingRate.id}`
        : "/api/settings/labor-rates";
      const method = editingRate ? "PATCH" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setMessage({
        type: "success",
        text: editingRate ? "Labor rate updated" : "Labor rate created",
      });
      setTimeout(() => setMessage(null), 3000);
      closeModal();
      fetchRates();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save labor rate",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rate: LaborRate) => {
    if (!confirm(`Delete labor rate "${rate.name}"?`)) return;

    setMessage(null);
    try {
      const res = await apiFetch(`/api/settings/labor-rates/${rate.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      setMessage({ type: "success", text: "Labor rate deleted" });
      setTimeout(() => setMessage(null), 3000);
      fetchRates();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to delete labor rate",
      });
    }
  };

  if (loading) {
    return <p style={{ color: "#6b7280", padding: "2rem", textAlign: "center" }}>Loading...</p>;
  }

  return (
    <div className="settings-section">
      <div className="section-header">
        <div>
          <h2>Labor Rates</h2>
          <p>Manage hourly labor rates for work orders and invoicing</p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          + Add Labor Rate
        </button>
      </div>

      {message && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      {laborRates.length === 0 ? (
        <div className="lr-empty-state">
          <p>No labor rates configured yet.</p>
          <button onClick={openAddModal} className="btn btn-primary">
            Add Your First Labor Rate
          </button>
        </div>
      ) : (
        <div className="labor-rates-list">
          {laborRates.map((rate) => (
            <div key={rate.id} className="labor-rate-card">
              <div className="lr-card-header">
                <div>
                  <h3>{rate.name}</h3>
                  {rate.description && (
                    <p className="lr-description">{rate.description}</p>
                  )}
                </div>
                {rate.isDefault && (
                  <span className="lr-default-badge">Default</span>
                )}
              </div>
              <div className="lr-amount">
                ${Number(rate.hourlyRate).toFixed(2)}
                <span className="lr-unit">/hour</span>
              </div>
              <div className="lr-actions">
                <button
                  onClick={() => openEditModal(rate)}
                  className="btn btn-sm btn-outline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(rate)}
                  className="btn btn-sm btn-danger-outline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingRate ? "Edit Labor Rate" : "Add Labor Rate"}</h3>

            <form onSubmit={handleSubmit}>
              <div className="lr-form-grid">
                <div className="lr-form-field">
                  <label>Rate Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Standard, Overtime, Weekend"
                    required
                    autoFocus
                  />
                </div>

                <div className="lr-form-field">
                  <label>Hourly Rate *</label>
                  <div className="lr-input-prefix-wrapper">
                    <span className="lr-input-prefix">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="lr-form-field lr-full-width">
                  <label>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={2}
                  />
                </div>

                <div className="lr-form-field lr-full-width">
                  <label className="lr-checkbox-label">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                    />
                    Set as default rate
                  </label>
                  <small>Default rate is pre-selected on new work orders</small>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Saving..." : editingRate ? "Save Changes" : "Add Rate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
