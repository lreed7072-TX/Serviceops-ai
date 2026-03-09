import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  // Get connection status
  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
    select: {
      id: true, realmId: true, companyName: true, connectedAt: true,
      lastSyncAt: true, accessTokenExpiry: true, refreshTokenExpiry: true,
    },
  });

  if (!connection) {
    return NextResponse.json({ data: { connected: false, connection: null, entityStats: {}, queueStats: null } });
  }

  // Get sync stats per entity type from QboSyncLog
  const entityTypes = ["customer", "invoice", "item", "estimate", "payment"];
  const entityStats: Record<string, { lastSync: string | null; successCount: number; failedCount: number }> = {};

  const [logCounts, lastSyncs] = await Promise.all([
    // Count success/failed per entity type
    prisma.qboSyncLog.groupBy({
      by: ["entityType", "status"],
      where: { orgId },
      _count: true,
    }),
    // Last successful sync per entity type
    Promise.all(entityTypes.map(async (et) => {
      const last = await prisma.qboSyncLog.findFirst({
        where: { orgId, entityType: et, status: "success" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return { entityType: et, lastSync: last?.createdAt?.toISOString() || null };
    })),
  ]);

  for (const et of entityTypes) {
    const successEntry = logCounts.find((c) => c.entityType === et && c.status === "success");
    const failedEntry = logCounts.find((c) => c.entityType === et && c.status === "failed");
    const lastSync = lastSyncs.find((l) => l.entityType === et);
    entityStats[et] = {
      lastSync: lastSync?.lastSync || null,
      successCount: successEntry?._count || 0,
      failedCount: failedEntry?._count || 0,
    };
  }

  // Get queue stats
  const [pendingCount, claimedCount, deadLetterCount, completedCount] = await Promise.all([
    prisma.qboSyncJob.count({ where: { orgId, status: "pending" } }),
    prisma.qboSyncJob.count({ where: { orgId, status: "claimed" } }),
    prisma.qboSyncJob.count({ where: { orgId, status: "dead_letter" } }),
    prisma.qboSyncJob.count({ where: { orgId, status: "completed" } }),
  ]);

  return NextResponse.json({
    data: {
      connected: true,
      connection: {
        realmId: connection.realmId,
        companyName: connection.companyName,
        connectedAt: connection.connectedAt,
        lastSyncAt: connection.lastSyncAt,
        tokenExpiresAt: connection.accessTokenExpiry,
        refreshTokenExpiresAt: connection.refreshTokenExpiry,
      },
      entityStats,
      queueStats: {
        pending: pendingCount,
        claimed: claimedCount,
        deadLetter: deadLetterCount,
        completed: completedCount,
      },
    },
  });
}
