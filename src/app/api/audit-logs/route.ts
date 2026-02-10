import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/audit-logs
 * Get audit logs (ADMIN only)
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN"]);
    if (roleCheck) return roleCheck;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");

    const where: Record<string, unknown> = { orgId: auth.orgId };

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data: logs });
  } catch (error) {
    console.error("Get audit logs error:", error);
    return NextResponse.json(
      { error: "Failed to load audit logs" },
      { status: 500 }
    );
  }
}
