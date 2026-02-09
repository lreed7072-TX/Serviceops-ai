"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import PMScheduleForm from "@/components/pm/PMScheduleForm";

interface AssetOption {
  id: string;
  name: string;
  serialNumber: string | null;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  assetCategory: string | null;
}

export default function NewPMSchedulePage() {
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [assetsRes, templatesRes] = await Promise.all([
          apiFetch("/api/assets", { cache: "no-store" }),
          apiFetch("/api/procedure-templates", { cache: "no-store" }),
        ]);

        if (assetsRes.ok) {
          const assetsJson = await assetsRes.json();
          setAssets(assetsJson.data ?? []);
        }
        if (templatesRes.ok) {
          const templatesJson = await templatesRes.json();
          setTemplates(templatesJson.data ?? []);
        }
      } catch {
        // Silently fail - form will show empty dropdowns
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
          Loading form data...
        </p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ marginBottom: "8px" }}>
            <Link
              href="/pm-schedules"
              style={{ color: "#3b82f6", textDecoration: "none", fontSize: "14px" }}
            >
              &larr; Back to PM Schedules
            </Link>
          </div>
          <h1>Create PM Schedule</h1>
          <p className="page-subtitle">
            Set up automated preventive maintenance for equipment
          </p>
        </div>
      </div>

      <PMScheduleForm
        assets={assets}
        procedureTemplates={templates}
      />
    </div>
  );
}
