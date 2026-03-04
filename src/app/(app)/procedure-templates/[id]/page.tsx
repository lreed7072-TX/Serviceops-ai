"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import "../procedure-detail.css";

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
      <div className="procedure-detail-page">
        <p className="pd-loading">Loading template...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="procedure-detail-page">
        <div className="pd-alert-error">{error || "Template not found"}</div>
        <Link href="/procedure-templates" className="pd-back-link">&larr; Back to Templates</Link>
      </div>
    );
  }

  return (
    <div className="procedure-detail-page">
      <Link href="/procedure-templates" className="pd-back-link">
        &larr; Back to Templates
      </Link>

      {/* Template Header */}
      <div className="pd-header-card">
        <div className="pd-header-top">
          <div>
            <h1>{template.name}</h1>
            {template.description && (
              <p className="pd-header-desc">{template.description}</p>
            )}
          </div>
          <button onClick={handleDelete} className="pd-btn-danger">
            Archive
          </button>
        </div>

        <div className="pd-header-badges">
          <span className="pd-badge">{template.assetCategory}</span>
          {template.assetFamily && <span className="pd-badge">{template.assetFamily}</span>}
          <span className="pd-badge context">
            {contextLabels[template.context] || template.context}
          </span>
          {template.estimatedDurationMinutes && (
            <span className="pd-badge">~{template.estimatedDurationMinutes} min</span>
          )}
          <span className="pd-badge">{template.steps.length} steps</span>
          <span className="pd-badge">v{template.version}</span>
        </div>

        <div className="pd-header-meta">
          Created by {template.createdBy.name || template.createdBy.email}
        </div>
      </div>

      {/* Steps Section */}
      <div className="pd-steps-card">
        <div className="pd-steps-header">
          <h2>Procedure Steps ({template.steps.length})</h2>
          <button
            onClick={() => setShowAddStep(!showAddStep)}
            className="pd-btn-primary"
          >
            {showAddStep ? "Cancel" : "+ Add Step"}
          </button>
        </div>

        <div className="pd-steps-body">
          {error && <div className="pd-alert-error">{error}</div>}

          {/* Add Step Form */}
          {showAddStep && (
            <div className="pd-add-step-form">
              <h3>New Step</h3>
              <form onSubmit={handleAddStep}>
                <div className="pd-form-field">
                  <label className="pd-form-label">
                    Title <span className="required">*</span>
                  </label>
                  <input
                    className="pd-form-input"
                    type="text"
                    value={stepForm.title}
                    onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                    placeholder="e.g., Disconnect power supply"
                    required
                  />
                </div>

                <div className="pd-form-field">
                  <label className="pd-form-label">Description</label>
                  <textarea
                    className="pd-form-textarea"
                    value={stepForm.description}
                    onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                    placeholder="Detailed instructions..."
                    rows={2}
                  />
                </div>

                <div className="pd-form-row">
                  <div className="pd-form-field">
                    <label className="pd-form-label">Domain</label>
                    <select
                      className="pd-form-select"
                      value={stepForm.domain}
                      onChange={(e) => setStepForm({ ...stepForm, domain: e.target.value })}
                    >
                      <option value="">None</option>
                      <option value="MECHANICAL">Mechanical</option>
                      <option value="ELECTRICAL">Electrical</option>
                      <option value="CONTROLS">Controls</option>
                      <option value="INSTRUMENTATION">Instrumentation</option>
                    </select>
                  </div>

                  <div className="pd-form-field">
                    <label className="pd-form-label">Est. Minutes</label>
                    <input
                      className="pd-form-input"
                      type="number"
                      value={stepForm.estimatedMinutes}
                      onChange={(e) => setStepForm({ ...stepForm, estimatedMinutes: e.target.value })}
                      placeholder="e.g., 15"
                      min="1"
                    />
                  </div>
                </div>

                <div className="pd-checkbox-row">
                  <label className="pd-checkbox-label">
                    <input
                      type="checkbox"
                      checked={stepForm.isCritical}
                      onChange={(e) => setStepForm({ ...stepForm, isCritical: e.target.checked })}
                    />
                    Critical Step
                  </label>
                  <label className="pd-checkbox-label">
                    <input
                      type="checkbox"
                      checked={stepForm.requiresEvidence}
                      onChange={(e) => setStepForm({ ...stepForm, requiresEvidence: e.target.checked })}
                    />
                    Requires Evidence
                  </label>
                </div>

                <button type="submit" className="pd-btn-primary" disabled={submitting}>
                  {submitting ? "Adding..." : "Add Step"}
                </button>
              </form>
            </div>
          )}

          {/* Steps List */}
          {template.steps.length === 0 ? (
            <p className="pd-empty">No steps yet. Add your first step above!</p>
          ) : (
            <div className="pd-steps-grid">
              {template.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`pd-step-item${step.isCritical ? " critical" : ""}`}
                >
                  <div className="pd-step-top">
                    <div className="pd-step-info">
                      <div className="pd-step-title-row">
                        <span className="pd-step-number">#{idx + 1}</span>
                        <span className="pd-step-title">{step.title}</span>
                        {step.isCritical && (
                          <span className="pd-badge critical">Critical</span>
                        )}
                        {step.domain && (
                          <span
                            className="pd-badge"
                            style={{ background: domainColors[step.domain], color: "white" }}
                          >
                            {step.domain}
                          </span>
                        )}
                        {step.estimatedMinutes && (
                          <span className="pd-badge">~{step.estimatedMinutes} min</span>
                        )}
                      </div>
                      {step.description && (
                        <p className="pd-step-desc">{step.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
