"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

type ProcedureStep = {
  id: string;
  title: string;
  description: string | null;
  domain: string | null;
  isCritical: boolean;
  requiresEvidence: boolean;
  estimatedMinutes: number | null;
  sequenceNumber: number;
};

type ProcedureTemplate = {
  id: string;
  name: string;
  description: string | null;
  assetCategory: string;
  assetFamily: string | null;
  assetSubfamily: string | null;
  context: string;
  estimatedDurationMinutes: number | null;
  version: number;
  status: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  steps: ProcedureStep[];
};

const contextLabels: Record<string, string> = {
  REPAIR: "Repair",
  STARTUP: "Startup",
  PM: "Preventive Maintenance",
  INSTALL: "Installation",
  INSPECTION: "Inspection",
  TROUBLESHOOTING: "Troubleshooting",
};

const domainColors: Record<string, string> = {
  MECHANICAL: "#10b981",
  ELECTRICAL: "#f59e0b",
  CONTROLS: "#3b82f6",
  INSTRUMENTATION: "#8b5cf6",
};

export default function ProcedureTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<ProcedureTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [stepForm, setStepForm] = useState({
    title: "",
    description: "",
    domain: "",
    isCritical: false,
    requiresEvidence: false,
    estimatedMinutes: "",
  });

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/procedure-templates/${templateId}`);
      if (!res.ok) throw new Error("Failed to load template");
      const json = await res.json();
      setTemplate(json.data);
    } catch (e: any) {
      setError(e?.message || "Failed to load template");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/procedure-templates/${templateId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: stepForm.title.trim(),
          description: stepForm.description.trim() || undefined,
          domain: stepForm.domain || undefined,
          isCritical: stepForm.isCritical,
          requiresEvidence: stepForm.requiresEvidence,
          estimatedMinutes: stepForm.estimatedMinutes ? parseInt(stepForm.estimatedMinutes) : undefined,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to create step");
      }

      // Reset form and reload
      setStepForm({
        title: "",
        description: "",
        domain: "",
        isCritical: false,
        requiresEvidence: false,
        estimatedMinutes: "",
      });
      setShowAddStep(false);
      await loadTemplate();
    } catch (e: any) {
      setError(e?.message || "Failed to create step");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Archive this template? It will no longer appear in the active list.")) return;

    try {
      const res = await apiFetch(`/api/procedure-templates/${templateId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to archive template");
      router.push("/procedure-templates");
    } catch (e: any) {
      setError(e?.message || "Failed to archive template");
    }
  };

  if (loading) {
    return (
      <div>
        <p className="muted">Loading template...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div>
        <div className="alert alert-error">{error || "Template not found"}</div>
        <Link href="/procedure-templates">← Back to Templates</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link href="/procedure-templates" style={{ color: "var(--primary)", textDecoration: "none" }}>
          ← Back to Templates
        </Link>
      </div>

      {/* Template Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <h1 style={{ margin: 0 }}>{template.name}</h1>
            {template.description && (
              <p style={{ margin: "8px 0 0", color: "var(--text-muted)" }}>{template.description}</p>
            )}
          </div>
          <button onClick={handleDelete} className="btn btn-danger btn-sm">
            Archive
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <span className="badge">{template.assetCategory}</span>
          {template.assetFamily && <span className="badge">{template.assetFamily}</span>}
          <span className="badge" style={{ background: "#3b82f6", color: "white" }}>
            {contextLabels[template.context] || template.context}
          </span>
          {template.estimatedDurationMinutes && (
            <span className="badge">~{template.estimatedDurationMinutes} min</span>
          )}
          <span className="badge">{template.steps.length} steps</span>
          <span className="badge">v{template.version}</span>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
          Created by {template.createdBy.name || template.createdBy.email}
        </div>
      </div>

      {/* Steps Section */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Procedure Steps ({template.steps.length})</h2>
          <button
            onClick={() => setShowAddStep(!showAddStep)}
            className="btn btn-primary btn-sm"
          >
            {showAddStep ? "Cancel" : "+ Add Step"}
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Add Step Form */}
        {showAddStep && (
          <div className="card" style={{ marginBottom: 24, background: "#f9fafb", padding: 16 }}>
            <h3 style={{ margin: "0 0 16px" }}>New Step</h3>
            <form onSubmit={handleAddStep}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                  Title <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  value={stepForm.title}
                  onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                  placeholder="e.g., Disconnect power supply"
                  required
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                  Description
                </label>
                <textarea
                  value={stepForm.description}
                  onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                  placeholder="Detailed instructions..."
                  rows={2}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                    Domain
                  </label>
                  <select
                    value={stepForm.domain}
                    onChange={(e) => setStepForm({ ...stepForm, domain: e.target.value })}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border)" }}
                  >
                    <option value="">None</option>
                    <option value="MECHANICAL">Mechanical</option>
                    <option value="ELECTRICAL">Electrical</option>
                    <option value="CONTROLS">Controls</option>
                    <option value="INSTRUMENTATION">Instrumentation</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                    Est. Minutes
                  </label>
                  <input
                    type="number"
                    value={stepForm.estimatedMinutes}
                    onChange={(e) => setStepForm({ ...stepForm, estimatedMinutes: e.target.value })}
                    placeholder="e.g., 15"
                    min="1"
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border)" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={stepForm.isCritical}
                    onChange={(e) => setStepForm({ ...stepForm, isCritical: e.target.checked })}
                  />
                  Critical Step
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={stepForm.requiresEvidence}
                    onChange={(e) => setStepForm({ ...stepForm, requiresEvidence: e.target.checked })}
                  />
                  Requires Evidence
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? "Adding..." : "Add Step"}
              </button>
            </form>
          </div>
        )}

        {/* Steps List */}
        {template.steps.length === 0 ? (
          <p className="muted">No steps yet. Add your first step above!</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {template.steps.map((step, idx) => (
              <div
                key={step.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 12,
                  background: step.isCritical ? "#fff3f3" : "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: "#6b7280" }}>#{idx + 1}</span>
                      <strong>{step.title}</strong>
                      {step.isCritical && (
                        <span className="badge critical">Critical</span>
                      )}
                      {step.domain && (
                        <span
                          className="badge"
                          style={{ background: domainColors[step.domain], color: "white" }}
                        >
                          {step.domain}
                        </span>
                      )}
                      {step.estimatedMinutes && (
                        <span className="badge">~{step.estimatedMinutes} min</span>
                      )}
                    </div>
                    {step.description && (
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
