import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string; findingId: string }>;
};

/**
 * DELETE /api/tasks/:id/findings/:findingId
 * Delete a finding from a task
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id: taskId, findingId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const finding = await prisma.taskFinding.findFirst({
    where: { id: findingId, taskInstanceId: taskId, orgId: auth.orgId },
  });
  if (!finding) return jsonError("Finding not found.", 404);

  await prisma.taskFinding.delete({ where: { id: findingId } });

  return NextResponse.json({ success: true });
}
