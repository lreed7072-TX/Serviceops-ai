import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// GET /api/integrations/qbo/status
// Returns the current QBO connection status for the org
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const connection = await prisma.qboConnection.findFirst({
    where: { orgId },
    select: {
      id: true,
      realmId: true,
      companyName: true,
      isActive: true,
      connectedAt: true,
      lastSyncAt: true,
    },
  });

  if (!connection || !connection.isActive) {
    return NextResponse.json({
      data: { connected: false, connection: null },
    });
  }

  // Fetch recent sync logs
  const recentLogs = await prisma.qboSyncLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      entityType: true,
      action: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      qboEntityId: true,
    },
  });

  return NextResponse.json({
    data: {
      connected: true,
      connection: {
        id: connection.id,
        realmId: connection.realmId,
        companyName: connection.companyName,
        connectedAt: connection.connectedAt,
        lastSyncAt: connection.lastSyncAt,
      },
      recentLogs,
    },
  });
}
