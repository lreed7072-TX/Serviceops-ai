"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import "../procedure-detail.css";

const assetCategories = [
  "PUMP",
  "MOTOR",
  "CONTROL_PANEL",
  "VFD",
  "VALVE",
  "SENSOR",
  "TRANSMITTER",
  "ACTUATOR",
  "OTHER",
];

const contexts = [
  { value: "REPAIR", label: "Repair" },
  { value: "STARTUP", label: "Startup" },
  { value: "PM", label: "Preventive Maintenance" },
  { value: "INSTALL", label: "Installation" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "TROUBLESHOOTING", label: "Troubleshooting" },
];

export default function NewProcedureTemplatePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    assetCategory: "",
    assetFamily: "",
    assetSubfamily: "",
    context: "",
    estimatedDurationMinutes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        assetCategory: form.assetCategory,
        assetFamily: form.assetFamily.trim() || undefined,
        assetSubfamily: form.assetSubfamily.trim() || undefined,
        context: form.context,
        estimatedDurationMinutes: form.estimatedDurationMinutes
          ? parseInt(form.estimatedDurationMinutes)
          : undefined,
      };

      console.log("Sending payload:", payload);

      const res = await apiFetch("/api/procedure-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("Response status:", res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error("Error response:", text);
        try {
          const json = JSON.parse(text);
          throw new Error(json.error || "Failed to create template");
        } catch {
          throw new Error(`Server error (${res.status}): ${text.substring(0, 200)}`);
        }
      }

      const json = await res.json();
      router.push(`/procedure-templates/${json.data.id}`);
    } catch (e: any) {
      console.error("Template creation error:", e);
      setError(e?.message || "Failed to create template");
      setSubmitting(false);
    }
  };

  return (
    <div className="procedure-detail-page">
      <Link href="/procedure-templates" className="pd-back-link">
        &larr; Back to Templates
      </Link>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#111827", margin: "0 0 1.5rem" }}>
        Create Procedure Template
      </h1>

      <div className="pd-create-card">
        {error && <div className="pd-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="pd-form-field">
            <label className="pd-form-label">
              Template Name <span className="required">*</span>
            </label>
            <input
              className="pd-form-input"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Submersible Pump Seal Replacement"
              required
            />
          </div>

          {/* Description */}
          <div className="pd-form-field">
            <label className="pd-form-label">Description</label>
            <textarea
              className="pd-form-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this procedure..."
              rows={3}
            />
          </div>

          {/* Asset Category */}
          <div className="pd-form-field">
            <label className="pd-form-label">
              Asset Category <span className="required">*</span>
            </label>
            <select
              className="pd-form-select"
              value={form.assetCategory}
              onChange={(e) => setForm({ ...form, assetCategory: e.target.value })}
              required
            >
              <option value="">Select category...</option>
              {assetCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Asset Family */}
          <div className="pd-form-field">
            <label className="pd-form-label">Asset Family (optional)</label>
            <input
              className="pd-form-input"
              type="text"
              value={form.assetFamily}
              onChange={(e) => setForm({ ...form, assetFamily: e.target.value })}
              placeholder="e.g., SUBMERSIBLE_WASTEWATER"
            />
          </div>

          {/* Asset Subfamily */}
          <div className="pd-form-field">
            <label className="pd-form-label">Asset Subfamily (optional)</label>
            <input
              className="pd-form-input"
              type="text"
              value={form.assetSubfamily}
              onChange={(e) => setForm({ ...form, assetSubfamily: e.target.value })}
              placeholder="e.g., GRINDER_PUMP"
            />
          </div>

          {/* Context */}
          <div className="pd-form-field">
            <label className="pd-form-label">
              Context <span className="required">*</span>
            </label>
            <select
              className="pd-form-select"
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              required
            >
              <option value="">Select context...</option>
              {contexts.map((ctx) => (
                <option key={ctx.value} value={ctx.value}>
                  {ctx.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estimated Duration */}
          <div className="pd-form-field">
            <label className="pd-form-label">Estimated Duration (minutes)</label>
            <input
              className="pd-form-input"
              type="number"
              value={form.estimatedDurationMinutes}
              onChange={(e) => setForm({ ...form, estimatedDurationMinutes: e.target.value })}
              placeholder="e.g., 120"
              min="1"
            />
          </div>

          {/* Actions */}
          <div className="pd-create-actions">
            <button type="submit" className="pd-btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Template"}
            </button>
            <Link href="/procedure-templates" className="pd-btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
