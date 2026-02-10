import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type CompletePayload = {
  completionNotes?: string;
  skipChecks?: boolean;
};

/**
 * GET /api/work-orders/:id/complete
 * Pre-flight check: returns completion readiness data
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
    include: {
      packages: {
        include: {
          tasks: {
            select: { id: true, title: true, status: true, isCritical: true, requiresEvidence: true },
          },
        },
      },
      signatures: { select: { id: true, signatureType: true } },
      siteCheckIns: {
        where: { userId: auth.userId, checkOutAt: null },
        select: { id: true },
      },
      timeEntries: {
        where: { status: "RUNNING" },
        select: { id: true },
      },
    },
  });

  if (!workOrder) return jsonError("Work order not found.", 404);

  const allTasks = workOrder.packages.flatMap((p) => p.tasks);
  const incompleteTasks = allTasks.filter((t) => t.status !== "DONE" && t.status !== "SKIPPED");
  const criticalIncomplete = incompleteTasks.filter((t) => t.isCritical);
  const hasCustomerSignature = workOrder.signatures.some((s) => s.signatureType === "CUSTOMER");
  const hasTechSignature = workOrder.signatures.some((s) => s.signatureType === "TECH");
  const hasActiveCheckIn = workOrder.siteCheckIns.length > 0;
  const hasRunningTimers = workOrder.timeEntries.length > 0;

  return NextResponse.json({
    data: {
      workOrderId,
      status: workOrder.status,
      totalTasks: allTasks.length,
      completedTasks: allTasks.filter((t) => t.status === "DONE").length,
      skippedTasks: allTasks.filter((t) => t.status === "SKIPPED").length,
      incompleteTasks: incompleteTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, isCritical: t.isCritical })),
      criticalIncomplete: criticalIncomplete.length,
      hasCustomerSignature,
      hasTechSignature,
      hasActiveCheckIn,
      hasRunningTimers,
      canComplete: criticalIncomplete.length === 0 && hasTechSignature,
    },
  });
}

/**
 * POST /api/work-orders/:id/complete
 * Complete a work order
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
    include: {
      packages: {
        include: {
          tasks: { select: { id: true, status: true, isCritical: true } },
        },
      },
      signatures: { select: { signatureType: true } },
    },
  });

  if (!workOrder) return jsonError("Work order not found.", 404);
  if (workOrder.status === "COMPLETED") return jsonError("Work order is already completed.", 400);
  if (workOrder.status === "CANCELED") return jsonError("Cannot complete a canceled work order.", 400);

  const body = await parseJson<CompletePayload>(request);
  const allTasks = workOrder.packages.flatMap((p) => p.tasks);
  const criticalIncomplete = allTasks.filter((t) => t.isCritical && t.status !== "DONE" && t.status !== "SKIPPED");
  const hasTechSig = workOrder.signatures.some((s) => s.signatureType === "TECH");

  if (!body?.skipChecks) {
    if (criticalIncomplete.length > 0) {
      return jsonError(`${criticalIncomplete.length} critical task(s) are not completed.`, 400);
    }
    if (!hasTechSig) {
      return jsonError("Tech signature is required before completing.", 400);
    }
  }

  // Stop any running timers for this WO
  await prisma.timeEntry.updateMany({
    where: { workOrderId, orgId: auth.orgId, status: "RUNNING" },
    data: { status: "STOPPED", stoppedAt: new Date() },
  });

  // Auto check-out if checked in
  await prisma.siteCheckIn.updateMany({
    where: { workOrderId, orgId: auth.orgId, userId: auth.userId, checkOutAt: null },
    data: { checkOutAt: new Date() },
  });

  // Complete the work order
  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      description: body?.completionNotes
        ? `${workOrder.description || ""}\n\n--- Completion Notes ---\n${body.completionNotes}`.trim()
        : workOrder.description,
    },
  });

  return NextResponse.json({ data: updated });
}
