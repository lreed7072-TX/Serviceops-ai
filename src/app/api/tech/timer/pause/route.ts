import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TimeEntryStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/tech/timer/pause
 * Pause the user's currently running timer.
 * Accumulates elapsed time and sets status to PAUSED.
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  // Find running timer
  const runningTimer = await prisma.timeEntry.findFirst({
    where: {
      orgId: auth.orgId,
      userId: auth.userId,
      status: TimeEntryStatus.RUNNING,
    },
  });

  if (!runningTimer) {
    return jsonError("No running timer to pause.", 404);
  }

  const now = new Date();
  const elapsed = Math.floor(
    (now.getTime() - new Date(runningTimer.startedAt).getTime()) / 1000
  );

  const paused = await prisma.timeEntry.update({
    where: { id: runningTimer.id },
    data: {
      status: TimeEntryStatus.PAUSED,
      pausedAt: now,
      accumulatedSeconds: runningTimer.accumulatedSeconds + elapsed,
    },
  });

  return NextResponse.json({ data: paused });
}
