import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TimeEntryStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * POST /api/tech/timer/resume
 * Resume a paused timer.
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  // Find paused timer
  const pausedTimer = await prisma.timeEntry.findFirst({
    where: {
      orgId: auth.orgId,
      userId: auth.userId,
      status: TimeEntryStatus.PAUSED,
    },
  });

  if (!pausedTimer) {
    return jsonError("No paused timer to resume.", 404);
  }

  const now = new Date();

  const resumed = await prisma.timeEntry.update({
    where: { id: pausedTimer.id },
    data: {
      status: TimeEntryStatus.RUNNING,
      startedAt: now, // New segment start time
      pausedAt: null,
    },
  });

  return NextResponse.json({ data: resumed });
}
