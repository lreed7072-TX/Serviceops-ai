import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

      const whereWO: any = { id, orgId: authResult.auth.orgId };
    if (authResult.auth.role === Role.TECH) {
      whereWO.OR = [
        { tasks: { some: { assignedToId: authResult.auth.userId } } },
        { visits: { some: { assignedTechId: authResult.auth.userId } } },
        { packages: { some: { leadTechId: authResult.auth.userId } } },
      ];
    }
    const workOrder = await prisma.workOrder.findFirst({ where: whereWO });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  const tasks = await prisma.taskInstance.findMany({
      where: {
        workOrderId: workOrder.id,
        orgId: authResult.auth.orgId,
        ...(authResult.auth.role === Role.TECH
          ? {
              OR: [
                { assignedToId: authResult.auth.userId },
                { workPackage: { leadTechId: authResult.auth.userId } },
              ],
            }
          : {}),
      } },
    orderBy: [
      { sequenceNumber: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      workPackage: true,
    },
  });

  return NextResponse.json({ data: tasks });
}
