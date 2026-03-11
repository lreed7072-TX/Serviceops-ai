import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * PATCH /api/ai/insights/:id/acknowledge
 * Acknowledge an AI insight with optional action taken.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const { id } = await params;

  // Verify insight belongs to org
  const existing = await prisma.aiInsight.findFirst({
    where: { id, orgId: auth.orgId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const actionTaken = (body as any)?.actionTaken ?? null;

  const insight = await prisma.aiInsight.update({
    where: { id },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedByUserId: auth.userId,
      actionTaken,
    },
  });

  return NextResponse.json({ data: insight });
}
