import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TimeEntryStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tech/timer
 * Returns the user's currently active (RUNNING or PAUSED) timer, if any.
 * Includes computed currentSeconds for UI display.
 */
export async function GET(request: Request) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;

    const { auth } = authResult;

    const activeTimer = await prisma.timeEntry.findFirst({
      where: {
        orgId: auth.orgId,
        userId: auth.userId,
        status: { in: [TimeEntryStatus.RUNNING, TimeEntryStatus.PAUSED] },
      },
      include: {
        taskInstance: {
          select: { id: true, title: true, status: true },
        },
        workOrder: {
          select: { id: true, title: true, workOrderNumber: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!activeTimer) {
      return NextResponse.json({ data: null });
    }

    // Calculate current total seconds
    let currentSeconds = activeTimer.accumulatedSeconds;
    
    if (activeTimer.status === TimeEntryStatus.RUNNING) {
      // Add elapsed time since last start/resume
      const elapsed = Math.floor(
        (Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000
      );
      currentSeconds += elapsed;
    }

    return NextResponse.json({
      data: {
        ...activeTimer,
        currentSeconds,
      },
    });
  } catch (error: any) {
    console.error("Timer API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
