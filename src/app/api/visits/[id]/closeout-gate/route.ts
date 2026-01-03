import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { TaskStatus, Role } from "@prisma/client";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const visitIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const parsedId = visitIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Visit ID must be a valid UUID or CUID.", 400);
  }

  const whereVisit: any = { id: parsedId.data, orgId: authResult.auth.orgId };
    if (authResult.auth.role === Role.TECH) {
      whereVisit.assignedTechId = authResult.auth.userId;
    }
    const visit = await prisma.visit.findFirst({
      where: whereVisit,
      select: { id: true, workOrderId: true },
    });if (!visit) {
    return jsonError("Visit not found.", 404);
  }

  const tasks = await prisma.taskInstance.findMany({
    where: {
      orgId: authResult.auth.orgId,
      workOrderId: visit.workOrderId,
      OR: [{ isCritical: true }, { requiresEvidence: true }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      isCritical: true,
      requiresEvidence: true,
      evidence: {
        where: { orgId: authResult.auth.orgId },
        select: { id: true },
        take: 1,
      },
    },
  });

  const blockers: Array<{
    type: "critical_task_incomplete" | "evidence_required_missing";
    taskId: string;
    message: string;
  }> = [];

  let criticalTotal = 0;
  let criticalIncomplete = 0;
  let evidenceRequiredTotal = 0;
  let evidenceMissing = 0;

  for (const task of tasks) {
    if (task.isCritical) {
      criticalTotal += 1;
      if (task.status !== TaskStatus.DONE) {
        criticalIncomplete += 1;
        blockers.push({
          type: "critical_task_incomplete",
          taskId: task.id,
          message: `Critical task "${task.title}" is not done.`,
        });
      }
    }

    if (task.requiresEvidence) {
      evidenceRequiredTotal += 1;
      if (task.evidence.length === 0) {
        evidenceMissing += 1;
        blockers.push({
          type: "evidence_required_missing",
          taskId: task.id,
          message: `Task "${task.title}" requires evidence.`,
        });
      }
    }
  }

  const canCloseout = blockers.length === 0;

  return NextResponse.json({
    data: {
      canCloseout,
      blockers,
      summary: {
        visitId: visit.id,
        criticalTasks: {
          total: criticalTotal,
          incomplete: criticalIncomplete,
        },
        evidenceRequired: {
          total: evidenceRequiredTotal,
          missing: evidenceMissing,
        },
      },
    },
  });
}
