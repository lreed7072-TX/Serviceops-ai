"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";

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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Procedure Templates</h1>
        <Link href="/procedure-templates/new" className="btn btn-primary">
          + Create Template
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Asset Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Context
            </label>
            <select
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
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
      </div>

      {/* Templates List */}
      <div className="card">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <p className="muted">Loading templates...</p>
        ) : templates.length === 0 ? (
          <p className="muted">No templates found. Create your first procedure template!</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {templates.map((template) => (
              <Link
                key={template.id}
                href={`/procedure-templates/${template.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="card"
                  style={{
                    padding: 16,
                    cursor: "pointer",
                    transition: "box-shadow 0.2s",
                    border: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{template.name}</h3>
                      {template.description && (
                        <p style={{ margin: "6px 0", fontSize: 14, color: "var(--text-muted)" }}>
                          {template.description}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                        <span className="badge">{template.assetCategory}</span>
                        {template.assetFamily && <span className="badge">{template.assetFamily}</span>}
                        <span className="badge" style={{ background: "#3b82f6", color: "white" }}>
                          {contextLabels[template.context] || template.context}
                        </span>
                        <span className="badge">{template._count.steps} steps</span>
                        {template.estimatedDurationMinutes && (
                          <span className="badge">~{template.estimatedDurationMinutes} min</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                    Created by {template.createdBy.name || template.createdBy.email} • Version {template.version}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
