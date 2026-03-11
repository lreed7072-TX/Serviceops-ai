"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { apiFetch } from "@/lib/api";
import PMScheduleCard from "@/components/pm/PMScheduleCard";
import PMCalendar from "@/components/pm/PMCalendar";
import "./pm-schedules.css";

interface PMSchedule {
  id: string;
  name: string;
  description: string | null;
  status: string;
  frequencyType: string | null;
  frequencyValue: number | null;
  nextScheduledDate: string | null;
  daysUntilNext: number | null;
  autoGenerateWorkOrders: boolean;
  asset: { id: string; name: string; serialNumber: string | null } | null;
  site: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  procedureTemplate: { id: string; name: string } | null;
  lastGeneratedWorkOrder: {
    id: string;
    workOrderNumber: string | null;
    status: string;
    dueDate: string | null;
  } | null;
}

interface AiInsight {
  id: string;
  insightType: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
}

interface AiIntervalMap {
  [assetId: string]: { recommendedDays: number; insightId: string };
}

export default function PMSchedulesPage() {
  const [schedules, setSchedules] = useState<PMSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [aiIntervalMap, setAiIntervalMap] = useState<AiIntervalMap>({});

  const fetchSchedules = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await apiFetch(`/api/pm-schedules${params}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setSchedules(json.data ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const fetchAiIntervalSuggestions = async () => {
    try {
      const res = await apiFetch(
        "/api/ai/insights?insightType=MAINTENANCE_FORECAST&activeOnly=true"
      );
      if (res.ok) {
        const json = await res.json();
        const insights: AiInsight[] = Array.isArray(json.data) ? json.data : [];
        const map: AiIntervalMap = {};
        for (const insight of insights) {
          if (insight.entityType === "Asset" && insight.entityId && insight.details) {
            const days = (insight.details as Record<string, unknown>).recommendedIntervalDays;
            if (typeof days === "number") {
              map[insight.entityId] = { recommendedDays: days, insightId: insight.id };
            }
          }
        }
        setAiIntervalMap(map);
      }
    } catch {
      // Non-critical — silently fail
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSchedules();
    fetchAiIntervalSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const activeCount = schedules.filter((s) => s.status === "ACTIVE").length;
  const dueSoonCount = schedules.filter(
    (s) => s.daysUntilNext !== null && s.daysUntilNext >= 0 && s.daysUntilNext <= 7
  ).length;
  const overdueCount = schedules.filter(
    (s) => s.daysUntilNext !== null && s.daysUntilNext < 0
  ).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>PM Schedules</h1>
          <p className="page-subtitle">
            Preventive maintenance scheduling and automation
          </p>
        </div>
        <Link href="/pm-schedules/new" className="btn btn-primary">
          + Create PM Schedule
        </Link>
      </div>

      {/* Stats */}
      <div className="pm-stats-grid">
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Active Schedules</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{dueSoonCount}</div>
          <div className="stat-label">Due Within 7 Days</div>
        </div>
        <div className="stat-card error">
          <div className="stat-value">{overdueCount}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      {/* View Toggle + Filter */}
      <div className="pm-toolbar">
        <div className="view-toggle">
          <button
            className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </button>
          <button
            className={`view-btn ${viewMode === "calendar" ? "active" : ""}`}
            onClick={() => setViewMode("calendar")}
          >
            Calendar
          </button>
        </div>

        {viewMode === "grid" && (
          <select
            className="pm-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
          Loading schedules...
        </p>
      ) : schedules.length === 0 ? (
        <div className="pm-empty">
          <div className="pm-empty-icon"><Wrench size={32} /></div>
          <h2>No PM Schedules Yet</h2>
          <p>
            Create your first preventive maintenance schedule to automate
            recurring work orders.
          </p>
          <Link href="/pm-schedules/new" className="btn btn-primary">
            Create PM Schedule
          </Link>
        </div>
      ) : viewMode === "calendar" ? (
        <PMCalendar schedules={schedules} />
      ) : (
        <div className="pm-schedules-grid">
          {schedules.map((schedule) => (
            <PMScheduleCard
              key={schedule.id}
              schedule={schedule}
              aiSuggestion={schedule.asset ? aiIntervalMap[schedule.asset.id] ?? null : null}
              onRefresh={fetchSchedules}
            />
          ))}
        </div>
      )}
    </div>
  );
}
