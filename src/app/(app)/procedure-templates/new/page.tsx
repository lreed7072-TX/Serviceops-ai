"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

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
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/procedure-templates" style={{ color: "var(--primary)", textDecoration: "none" }}>
          ← Back to Templates
        </Link>
      </div>

      <h1>Create Procedure Template</h1>

      <div className="card" style={{ maxWidth: 800 }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Template Name <span style={{ color: "red" }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Submersible Pump Seal Replacement"
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this procedure..."
              rows={3}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>

          {/* Asset Category */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Asset Category <span style={{ color: "red" }}>*</span>
            </label>
            <select
              value={form.assetCategory}
              onChange={(e) => setForm({ ...form, assetCategory: e.target.value })}
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
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
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Asset Family (optional)
            </label>
            <input
              type="text"
              value={form.assetFamily}
              onChange={(e) => setForm({ ...form, assetFamily: e.target.value })}
              placeholder="e.g., SUBMERSIBLE_WASTEWATER"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>

          {/* Asset Subfamily */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Asset Subfamily (optional)
            </label>
            <input
              type="text"
              value={form.assetSubfamily}
              onChange={(e) => setForm({ ...form, assetSubfamily: e.target.value })}
              placeholder="e.g., GRINDER_PUMP"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>

          {/* Context */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Context <span style={{ color: "red" }}>*</span>
            </label>
            <select
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
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
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
              Estimated Duration (minutes)
            </label>
            <input
              type="number"
              value={form.estimatedDurationMinutes}
              onChange={(e) => setForm({ ...form, estimatedDurationMinutes: e.target.value })}
              placeholder="e.g., 120"
              min="1"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Template"}
            </button>
            <Link href="/procedure-templates" className="btn btn-outline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
