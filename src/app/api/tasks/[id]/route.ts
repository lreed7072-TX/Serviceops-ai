import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TaskStatus } from "@prisma/client";

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// PATCH /api/tasks/[id] - Update task status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !Object.values(TaskStatus).includes(status)) {
      return jsonError("Valid status required", 400);
    }

    // Verify task belongs to org
    const existing = await prisma.taskInstance.findUnique({
      where: { id },
      select: { orgId: true, workOrderId: true, status: true },
    });

    if (!existing || existing.orgId !== auth.orgId) {
      return jsonError("Task not found", 404);
    }

    // Update task
    const updated = await prisma.taskInstance.update({
      where: { id },
      data: { status },
    });

    // Timer integration: Start/stop timers based on status change
    if (status === "IN_PROGRESS" && existing.status !== "IN_PROGRESS") {
      // Task started - create or resume timer
      const runningTimer = await prisma.timeEntry.findFirst({
        where: {
          orgId: auth.orgId,
          taskInstanceId: id,
          status: "RUNNING",
        },
      });

      if (!runningTimer) {
        await prisma.timeEntry.create({
          data: {
            orgId: auth.orgId,
            userId: auth.userId,
            workOrderId: existing.workOrderId,
            taskInstanceId: id,
            status: "RUNNING",
            startedAt: new Date(),
          },
        });
      }
    } else if (status === "DONE" && existing.status === "IN_PROGRESS") {
      // Task completed - stop timer
      const runningTimer = await prisma.timeEntry.findFirst({
        where: {
          orgId: auth.orgId,
          taskInstanceId: id,
          status: "RUNNING",
        },
      });

      if (runningTimer) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - runningTimer.startedAt.getTime()) / 1000);

        await prisma.timeEntry.update({
          where: { id: runningTimer.id },
          data: {
            status: "STOPPED",
            stoppedAt: now,
            accumulatedSeconds: runningTimer.accumulatedSeconds + elapsed,
          },
        });
      }
    }

    return jsonResponse({ data: updated });
  } catch (error) {
    console.error("Failed to update task:", error);
    return jsonError("Failed to update task", 500);
  }
}
