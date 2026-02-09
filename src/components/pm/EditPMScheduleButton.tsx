"use client";

import { useRouter } from "next/navigation";

interface EditPMScheduleButtonProps {
  scheduleId: string;
}

export default function EditPMScheduleButton({
  scheduleId,
}: EditPMScheduleButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/pm-schedules/${scheduleId}/edit`)}
      className="btn btn-outline"
    >
      Edit Schedule
    </button>
  );
}
