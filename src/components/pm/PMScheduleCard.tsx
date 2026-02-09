"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
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
      alert(data.message);
      onRefresh();
      router.push(`/work-orders/${data.data.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to generate work order");
    } finally {
      setGenerating(false);
    }
  };

  const getFrequencyLabel = () => {
    if (!schedule.frequencyType || !schedule.frequencyValue) return "—";
    const unit = FREQ_LABELS[schedule.frequencyType] || schedule.frequencyType.toLowerCase();
    if (schedule.frequencyValue === 1) return `Every ${unit}`;
    return `Every ${schedule.frequencyValue} ${unit}s`;
  };

  const cardClass = () => {
    if (schedule.daysUntilNext !== null && schedule.daysUntilNext < 0) return "overdue";
    if (schedule.daysUntilNext !== null && schedule.daysUntilNext <= 7) return "due-soon";
    return "";
  };

  const getDueBadge = () => {
    if (schedule.daysUntilNext === null) return null;
    if (schedule.daysUntilNext < 0) {
      return (
        <span className="pmc-due overdue">
          {Math.abs(schedule.daysUntilNext)}d Overdue
        </span>
      );
    }
    if (schedule.daysUntilNext === 0) {
      return <span className="pmc-due due-today">Due Today</span>;
    }
    if (schedule.daysUntilNext <= 7) {
      return <span className="pmc-due due-soon">Due in {schedule.daysUntilNext}d</span>;
    }
    return <span className="pmc-due upcoming">Due in {schedule.daysUntilNext}d</span>;
  };

  return (
    <div className={`pmc-card ${cardClass()}`}>
      <div className="pmc-header">
        <div className="pmc-title">
          <h3>{schedule.name}</h3>
          <span className={`pmc-status ${schedule.status.toLowerCase()}`}>
            {schedule.status}
          </span>
        </div>
        {getDueBadge()}
      </div>

      <div className="pmc-body">
        {schedule.asset && (
          <div className="pmc-row">
            <span className="pmc-label">Equipment:</span>
            <span className="pmc-value">{schedule.asset.name}</span>
          </div>
        )}
        {schedule.customer && schedule.site && (
          <div className="pmc-row">
            <span className="pmc-label">Location:</span>
            <span className="pmc-value">
              {schedule.customer.name} &bull; {schedule.site.name}
            </span>
          </div>
        )}
        <div className="pmc-row">
          <span className="pmc-label">Frequency:</span>
          <span className="pmc-value">{getFrequencyLabel()}</span>
        </div>
        {schedule.nextScheduledDate && (
          <div className="pmc-row">
            <span className="pmc-label">Next PM:</span>
            <span className="pmc-value">
              {new Date(schedule.nextScheduledDate).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      <div className="pmc-footer">
        {schedule.lastGeneratedWorkOrder ? (
          <div className="pmc-last-wo">
            <span className="pmc-last-wo-label">Last WO:</span>
            <Link
              href={`/work-orders/${schedule.lastGeneratedWorkOrder.id}`}
              className="pmc-last-wo-link"
              onClick={(e) => e.stopPropagation()}
            >
              {schedule.lastGeneratedWorkOrder.workOrderNumber || "View"}
            </Link>
            <span
              className={`pmc-wo-status ${schedule.lastGeneratedWorkOrder.status.toLowerCase()}`}
            >
              {schedule.lastGeneratedWorkOrder.status}
            </span>
          </div>
        ) : (
          <span className="pmc-last-wo-label" style={{ fontSize: "0.8125rem" }}>
            No work orders generated yet
          </span>
        )}

        {schedule.status === "ACTIVE" && (
          <button
            onClick={generateWorkOrder}
            disabled={generating}
            className="btn btn-primary pmc-gen-btn"
          >
            {generating ? "Generating..." : "Generate WO"}
          </button>
        )}
      </div>
    </div>
  );
}
