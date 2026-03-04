"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import "./procedure-templates.css";

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
  linkedStandardsPacks: Array<{
    id: string;
    name: string;
  }>;
  _count: {
    steps: number;
  };
};

const contextLabels: Record<string, string> = {
  REPAIR: "Repair",
  STARTUP: "Startup",
  PM: "Preventive Maintenance",
  INSTALL: "Installation",
  INSPECTION: "Inspection",
  TROUBLESHOOTING: "Troubleshooting",
};

export default function ProcedureTemplatesPage() {
  const [templates, setTemplates] = useState<ProcedureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [contextFilter, setContextFilter] = useState("");

  useEffect(() => {
    loadTemplates();
  }, [categoryFilter, contextFilter]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (contextFilter) params.set("context", contextFilter);

      const res = await apiFetch(`/api/procedure-templates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load templates");
      const json = await res.json();
      setTemplates(json.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories from templates
  const categories = Array.from(new Set(templates.map((t) => t.assetCategory))).sort();

  return (
    <div className="procedure-templates-page">
      <div className="pt-page-header">
        <div>
          <h1>Procedure Templates</h1>
          <p className="pt-page-subtitle">Create and manage reusable procedure workflows</p>
        </div>
        <Link href="/procedure-templates/new" className="pt-btn-primary">
          + Create Template
        </Link>
      </div>

      {/* Filters */}
      <div className="pt-filters">
        <div className="pt-filter-group">
          <label className="pt-filter-label">Asset Category</label>
          <select
            className="pt-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-filter-group">
          <label className="pt-filter-label">Context</label>
          <select
            className="pt-filter-select"
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value)}
          >
            <option value="">All Contexts</option>
            {Object.entries(contextLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates List */}
      <div className="pt-templates-card">
        <div className="pt-templates-body">
          {error && <div className="pt-alert-error">{error}</div>}

          {loading ? (
            <p className="pt-loading">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="pt-empty">No templates found. Create your first procedure template!</p>
          ) : (
            <div className="pt-grid">
              {templates.map((template) => (
                <Link
                  key={template.id}
                  href={`/procedure-templates/${template.id}`}
                  className="pt-template-card"
                >
                  <div className="pt-template-header">
                    <div>
                      <h3 className="pt-template-name">{template.name}</h3>
                      {template.description && (
                        <p className="pt-template-desc">{template.description}</p>
                      )}
                      <div className="pt-template-badges">
                        <span className="pt-badge">{template.assetCategory}</span>
                        {template.assetFamily && <span className="pt-badge">{template.assetFamily}</span>}
                        <span className="pt-badge context">
                          {contextLabels[template.context] || template.context}
                        </span>
                        <span className="pt-badge steps">{template._count.steps} steps</span>
                        {template.estimatedDurationMinutes && (
                          <span className="pt-badge duration">~{template.estimatedDurationMinutes} min</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-template-meta">
                    Created by {template.createdBy.name || template.createdBy.email} &bull; Version {template.version}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
