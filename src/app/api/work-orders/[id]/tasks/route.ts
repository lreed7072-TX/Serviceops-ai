import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  const tasks = await prisma.taskInstance.findMany({
    where: { workOrderId: workOrder.id, orgId: authResult.auth.orgId },
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
