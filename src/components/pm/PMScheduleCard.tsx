"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import "./PMScheduleCard.css";

interface PMScheduleCardProps {
  schedule: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    frequencyType: string | null;
    frequencyValue: number | null;
    nextScheduledDate: string | null;
    daysUntilNext: number | null;
    autoGenerateWorkOrders: boolean;
    asset: {
      id: string;
      name: string;
      serialNumber: string | null;
    } | null;
    site: { id: string; name: string } | null;
    customer: { id: string; name: string } | null;
    procedureTemplate: { id: string; name: string } | null;
    lastGeneratedWorkOrder: {
      id: string;
      workOrderNumber: string | null;
      status: string;
    } | null;
  };
  onRefresh: () => void;
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

export default function PMScheduleCard({ schedule, onRefresh }: PMScheduleCardProps) {
  const router = useRouter();
  const toast = useToast();
  const [generating, setGenerating] = useState(false);

  const generateWorkOrder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Generate a new work order for "${schedule.name}"?`)) return;

    setGenerating(true);
    try {
      const res = await apiFetch(
        `/api/pm-schedules/${schedule.id}/generate-work-order`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate");
      }

      const data = await res.json();
      toast.success(data.message);
      onRefresh();
      router.push(`/work-orders/${data.data.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate work order");
    } finally {
      setGenerating(false);
    }
  };

  const getFrequencyLabel = () => {
    if (!schedule.frequencyType || !schedule.frequencyValue) return "\u2014";
    const unit = FREQ_LABELS[schedule.frequencyType] || schedule.frequencyType.toLowerCase();
    if (schedule.frequencyValue === 1) return `Every ${unit}`;
    return `Every ${schedule.frequencyValue} ${unit}s`;
  };

  const getStatusBadgeClass = () => {
    switch (schedule.status) {
      case "ACTIVE": return "badge-active";
      case "DRAFT": return "badge-paused";
      case "ARCHIVED": return "badge-archived";
      default: return "";
    }
  };

  const getDueBadge = () => {
    if (schedule.daysUntilNext === null) return null;
    if (schedule.daysUntilNext < 0) {
      return (
        <span className="due-badge overdue">
          {Math.abs(schedule.daysUntilNext)}d Overdue
        </span>
      );
    }
    if (schedule.daysUntilNext === 0) {
      return <span className="due-badge due-today">Due Today</span>;
    }
    if (schedule.daysUntilNext <= 7) {
      return <span className="due-badge due-soon">Due in {schedule.daysUntilNext}d</span>;
    }
    return <span className="due-badge upcoming">Due in {schedule.daysUntilNext}d</span>;
  };

  return (
    <div className="pm-schedule-card">
      <div className="pm-card-header">
        <div className="pm-card-title">
          <h3>{schedule.name}</h3>
          <span className={`status-badge ${getStatusBadgeClass()}`}>
            {schedule.status}
          </span>
        </div>
        {getDueBadge()}
      </div>

      <div className="pm-card-body">
        {schedule.asset && (
          <div className="pm-info-row">
            <span className="pm-label">Equipment:</span>
            <span className="pm-value">{schedule.asset.name}</span>
          </div>
        )}
        {schedule.customer && schedule.site && (
          <div className="pm-info-row">
            <span className="pm-label">Location:</span>
            <span className="pm-value">
              {schedule.customer.name} &bull; {schedule.site.name}
            </span>
          </div>
        )}
        <div className="pm-info-row">
          <span className="pm-label">Frequency:</span>
          <span className="pm-value">{getFrequencyLabel()}</span>
        </div>
        {schedule.nextScheduledDate && (
          <div className="pm-info-row">
            <span className="pm-label">Next PM:</span>
            <span className="pm-value">
              {new Date(schedule.nextScheduledDate).toLocaleDateString()}
            </span>
          </div>
        )}
        {schedule.procedureTemplate && (
          <div className="pm-info-row">
            <span className="pm-label">Template:</span>
            <span className="pm-value">{schedule.procedureTemplate.name}</span>
          </div>
        )}
      </div>

      <div className="pm-card-actions">
        {schedule.lastGeneratedWorkOrder ? (
          <div className="last-wo-info">
            <span className="last-wo-label">Last WO:</span>
            <Link
              href={`/work-orders/${schedule.lastGeneratedWorkOrder.id}`}
              className="last-wo-link"
              onClick={(e) => e.stopPropagation()}
            >
              {schedule.lastGeneratedWorkOrder.workOrderNumber || "View"}
            </Link>
            <span
              className={`wo-status-badge ${schedule.lastGeneratedWorkOrder.status.toLowerCase()}`}
            >
              {schedule.lastGeneratedWorkOrder.status}
            </span>
          </div>
        ) : (
          <span className="last-wo-label" style={{ fontSize: "0.8125rem" }}>
            No work orders generated yet
          </span>
        )}

        {schedule.status === "ACTIVE" && (
          <button
            onClick={generateWorkOrder}
            disabled={generating}
            className="btn btn-primary generate-btn"
          >
            {generating ? "Generating..." : "Generate WO"}
          </button>
        )}
      </div>
    </div>
  );
}
