import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  // Assigned tasks for this tech (assignedToId = auth.userId)
  const tasks = await prisma.taskInstance.findMany({
    where: {
      orgId: auth.orgId,
      assignedToId: auth.userId,
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      isCritical: true,
      updatedAt: true,
      workOrder: {
        select: {
          id: true,
          title: true,
          workOrderNumber: true,
        },
      },
      workPackage: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ data: tasks });
}
