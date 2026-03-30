"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import EditPMScheduleForm from "@/components/pm/EditPMScheduleForm";

interface TemplateOption {
  id: string;
  name: string;
  assetCategory: string | null;
}

export default function EditPMSchedulePage() {
  const params = useParams();
  const scheduleId = params?.id as string;
  const [schedule, setSchedule] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleId) return;

    const fetchData = async () => {
      try {
        const [scheduleRes, templatesRes] = await Promise.all([
          apiFetch(`/api/pm-schedules/${scheduleId}`, { cache: "no-store" }),
          apiFetch("/api/procedure-templates"),
        ]);

        if (!scheduleRes.ok) {
          throw new Error("PM schedule not found");
        }

        const scheduleJson = await scheduleRes.json();
        setSchedule(scheduleJson.data);

        if (templatesRes.ok) {
          const templatesJson = await templatesRes.json();
          setTemplates(templatesJson.data ?? []);
        }
      } catch {
        setError("Failed to load PM schedule.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [scheduleId]);

  if (loading) {
    return (
      <div className="page-container">
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
          Loading schedule...
        </p>
      </div>
    );
  }

  if (error || !schedule) {
    return (
      <div className="page-container">
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Not Found</h1>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
            {error || "PM schedule not found."}
          </p>
          <Link href="/pm-schedules" className="btn btn-primary">
            Back to PM Schedules
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div style={{ marginBottom: "8px" }}>
            <Link
              href={`/pm-schedules/${scheduleId}`}
              style={{ color: "#3b82f6", textDecoration: "none", fontSize: "14px" }}
            >
              &larr; Back to {(schedule as Record<string, unknown>).name as string}
            </Link>
          </div>
          <h1>Edit PM Schedule</h1>
          <p className="page-subtitle">Update schedule settings and frequency</p>
        </div>
      </div>

      <EditPMScheduleForm schedule={schedule} procedureTemplates={templates} />
    </div>
  );
}
