import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TimeEntryStatus } from "@prisma/client";

export const runtime = "nodejs";

type StopTimerPayload = {
  notes?: string | null;
};

/**
 * POST /api/tech/timer/stop
 * Stop the user's active timer (RUNNING or PAUSED) and finalize the time entry.
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  const body = await parseJson<StopTimerPayload>(request);

  // Find active timer (running or paused)
  const activeTimer = await prisma.timeEntry.findFirst({
    where: {
      orgId: auth.orgId,
      userId: auth.userId,
      status: { in: [TimeEntryStatus.RUNNING, TimeEntryStatus.PAUSED] },
    },
  });

  if (!activeTimer) {
    return jsonError("No active timer to stop.", 404);
  }

  const now = new Date();
  let finalSeconds = activeTimer.accumulatedSeconds;

  // If running, add current segment time
  if (activeTimer.status === TimeEntryStatus.RUNNING) {
    const elapsed = Math.floor(
      (now.getTime() - new Date(activeTimer.startedAt).getTime()) / 1000
    );
    finalSeconds += elapsed;
  }

  const stopped = await prisma.timeEntry.update({
    where: { id: activeTimer.id },
    data: {
      status: TimeEntryStatus.STOPPED,
      stoppedAt: now,
      accumulatedSeconds: finalSeconds,
      notes: body?.notes ?? activeTimer.notes,
    },
  });

  return NextResponse.json({
    data: {
      ...stopped,
      totalSeconds: finalSeconds,
      totalMinutes: Math.round(finalSeconds / 60),
      totalHours: (finalSeconds / 3600).toFixed(2),
    },
  });
}
