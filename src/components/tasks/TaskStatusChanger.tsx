"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface TaskStatusChangerProps {
  taskId: string;
  currentStatus: string;
  onStatusChanged: () => void;
}

const STATUS_OPTIONS = [
  { value: "TODO", label: "To Do", color: "gray" },
  { value: "IN_PROGRESS", label: "In Progress", color: "blue" },
  { value: "DONE", label: "Done", color: "green" },
  { value: "BLOCKED", label: "Blocked", color: "red" },
  { value: "SKIPPED", label: "Skipped", color: "orange" },
];

export default function TaskStatusChanger({
  taskId,
  currentStatus,
  onStatusChanged,
}: TaskStatusChangerProps) {
  const [changing, setChanging] = useState(false);
  const toast = useToast();

  const changeStatus = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setChanging(true);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      onStatusChanged();
    } catch {
      toast.error("Failed to update task status");
    } finally {
      setChanging(false);
    }
  };

  const current = STATUS_OPTIONS.find((o) => o.value === currentStatus) ?? STATUS_OPTIONS[0];

  return (
    <select
      value={currentStatus}
      onChange={(e) => changeStatus(e.target.value)}
      disabled={changing}
      className={`tl-status-select tl-status-${current.color}`}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
