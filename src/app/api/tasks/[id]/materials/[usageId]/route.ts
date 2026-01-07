import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string; usageId: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: taskId, usageId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const existing = await prisma.taskMaterialUsage.findFirst({
    where: { id: usageId, taskInstanceId: taskId, orgId: authResult.auth.orgId },
  });
  if (!existing) return jsonError("Material usage not found.", 404);

  await prisma.taskMaterialUsage.delete({ where: { id: usageId } });
  return NextResponse.json({ data: { id: usageId } });
}
