import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TimeEntryStatus } from "@prisma/client";

export const runtime = "nodejs";

type StartTimerPayload = {
  workOrderId: string;
  taskInstanceId?: string | null;
  notes?: string | null;
};

/**
 * POST /api/tech/timer/start
 * Start a new timer for a work order (optionally linked to a specific task).
 * 
 * If the user has an active timer on a different task, it will be auto-stopped.
 * If the user has a paused timer on the same task, it will be resumed instead.
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  const body = await parseJson<StartTimerPayload>(request);
  if (!body?.workOrderId) {
    return jsonError("workOrderId is required.", 400);
  }

  // Validate work order belongs to org
  const workOrder = await prisma.workOrder.findFirst({
    where: { id: body.workOrderId, orgId: auth.orgId },
    select: { id: true },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  // Validate task if provided
  if (body.taskInstanceId) {
    const task = await prisma.taskInstance.findFirst({
      where: {
        id: body.taskInstanceId,
        orgId: auth.orgId,
        workOrderId: body.workOrderId,
      },
      select: { id: true },
    });

    if (!task) {
      return jsonError("Task not found or doesn't belong to this work order.", 404);
    }
  }

  // Check for existing active timers
  const existingTimers = await prisma.timeEntry.findMany({
    where: {
      orgId: auth.orgId,
      userId: auth.userId,
      status: { in: [TimeEntryStatus.RUNNING, TimeEntryStatus.PAUSED] },
    },
  });

  const now = new Date();

  // Check if there's a paused timer on the same task - if so, resume it
  const pausedSameTask = existingTimers.find(
    (t) =>
      t.status === TimeEntryStatus.PAUSED &&
      t.taskInstanceId === (body.taskInstanceId ?? null) &&
      t.workOrderId === body.workOrderId
  );

  if (pausedSameTask) {
    // Resume the paused timer
    const resumed = await prisma.timeEntry.update({
      where: { id: pausedSameTask.id },
      data: {
        status: TimeEntryStatus.RUNNING,
        startedAt: now, // Reset start time for this segment
        pausedAt: null,
      },
    });

    return NextResponse.json({ data: resumed, resumed: true });
  }

  // Auto-stop any other active timers
  for (const timer of existingTimers) {
    if (timer.status === TimeEntryStatus.RUNNING) {
      const elapsed = Math.floor(
        (now.getTime() - new Date(timer.startedAt).getTime()) / 1000
      );

      await prisma.timeEntry.update({
        where: { id: timer.id },
        data: {
          status: TimeEntryStatus.STOPPED,
          stoppedAt: now,
          accumulatedSeconds: timer.accumulatedSeconds + elapsed,
        },
      });
    } else if (timer.status === TimeEntryStatus.PAUSED) {
      // Just stop paused timers (already accumulated)
      await prisma.timeEntry.update({
        where: { id: timer.id },
        data: {
          status: TimeEntryStatus.STOPPED,
          stoppedAt: now,
        },
      });
    }
  }

  // Create new timer
  const newTimer = await prisma.timeEntry.create({
    data: {
      orgId: auth.orgId,
      userId: auth.userId,
      workOrderId: body.workOrderId,
      taskInstanceId: body.taskInstanceId ?? null,
      status: TimeEntryStatus.RUNNING,
      startedAt: now,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ data: newTimer }, { status: 201 });
}
