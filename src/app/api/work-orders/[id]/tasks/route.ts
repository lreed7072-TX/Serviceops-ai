import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // 1) Work order access gate (TECH must be assigned via task/visit/lead package)
  const whereWO: any = { id, orgId: auth.orgId };
  if (auth.role === Role.TECH) {
    whereWO.OR = [
      { tasks: { some: { assignedToId: auth.userId } } },
      { visits: { some: { assignedTechId: auth.userId } } },
      { packages: { some: { leadTechId: auth.userId } } },
    ];
  }

  const workOrder = await prisma.workOrder.findFirst({
    where: whereWO,
    select: { id: true },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  // 2) Task list filter (TECH sees assigned tasks + tasks in packages they lead)
  const whereTasks: any = { orgId: auth.orgId, workOrderId: workOrder.id };
  if (auth.role === Role.TECH) {
    whereTasks.OR = [
      { assignedToId: auth.userId },
      { workPackage: { leadTechId: auth.userId } },
    ];
  }

  const tasks = await prisma.taskInstance.findMany({
    where: whereTasks,
    orderBy: [{ sequenceNumber: "asc" }, { createdAt: "asc" }],
    include: { workPackage: true },
  });

  return NextResponse.json({ data: tasks });
}
