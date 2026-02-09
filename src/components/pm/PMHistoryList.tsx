"use client";

import Link from "next/link";
import "./PMHistoryList.css";

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface PMHistoryListProps {
  workOrders: WorkOrder[];
}

const WO_STATUS_COLORS: Record<string, string> = {
  OPEN: "wo-open",
  IN_PROGRESS: "wo-progress",
  COMPLETED: "wo-completed",
  CANCELLED: "wo-cancelled",
};

export default function PMHistoryList({ workOrders }: PMHistoryListProps) {
  if (workOrders.length === 0) {
    return (
      <div className="empty-history">
        <p>No work orders have been generated yet.</p>
      </div>
    );
  }

  return (
    <div className="pm-history-list">
      {workOrders.map((wo) => (
        <Link key={wo.id} href={`/work-orders/${wo.id}`} className="history-item">
          <div className="history-header">
            <span className="history-wo-number">{wo.workOrderNumber}</span>
            <span className={`history-status ${WO_STATUS_COLORS[wo.status] || "wo-default"}`}>
              {wo.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="history-title">{wo.title}</div>
          <div className="history-dates">
            <span>Created: {new Date(wo.createdAt).toLocaleDateString()}</span>
            {wo.dueDate && (
              <>
                <span className="history-sep">&bull;</span>
                <span>Due: {new Date(wo.dueDate).toLocaleDateString()}</span>
              </>
            )}
            {wo.completedAt && (
              <>
                <span className="history-sep">&bull;</span>
                <span>
                  Completed: {new Date(wo.completedAt).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
