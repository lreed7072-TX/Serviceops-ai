import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/ai/insights
 * List AI insights with optional filters.
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const insightType = searchParams.get("insightType");
  const severity = searchParams.get("severity");
  const activeOnly = searchParams.get("activeOnly") !== "false"; // default true

  const where: any = { orgId: auth.orgId };

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (insightType) where.insightType = insightType;
  if (severity) where.severity = severity;
  if (activeOnly) {
    where.acknowledgedAt = null;
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }

  const insights = await prisma.aiInsight.findMany({
    where,
    orderBy: [
      { severity: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
  });

  return NextResponse.json({ data: insights });
}
