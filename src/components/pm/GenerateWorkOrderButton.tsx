"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface GenerateWorkOrderButtonProps {
  scheduleId: string;
  scheduleName: string;
  onGenerated?: () => void;
}

export default function GenerateWorkOrderButton({
  scheduleId,
  scheduleName,
  onGenerated,
}: GenerateWorkOrderButtonProps) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (
      !confirm(
        `Generate a new preventive maintenance work order for "${scheduleName}"?`
      )
    ) {
      return;
    }

    setGenerating(true);
    try {
      const res = await apiFetch(
        `/api/pm-schedules/${scheduleId}/generate-work-order`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate work order");
      }

      const data = await res.json();
      alert(data.message);
      onGenerated?.();
      router.push(`/work-orders/${data.data.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to generate work order");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={generating}
      className="btn btn-primary"
    >
      {generating ? "Generating..." : "Generate Work Order"}
    </button>
  );
}
