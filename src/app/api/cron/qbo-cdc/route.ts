import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cdcRequest } from "@/lib/qbo/qbo-client";
import { enqueue } from "@/lib/qbo/qbo-queue";
import { fetchAndCachePreferences } from "@/lib/qbo/qbo-sync";
import type { QboCdcResponse } from "@/lib/qbo/qbo-types";
import type { QboConnection } from "@prisma/client";

/**
 * GET /api/cron/qbo-cdc
 * Vercel Cron job — polls QBO Change Data Capture every 4 hours.
 * Discovers Customer and Invoice changes across all connected orgs and
 * enqueues pull jobs to the sync queue for deferred processing.
 * Secured via CRON_SECRET header (same pattern as qbo-flush).
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = {
    orgsPolled: 0,
    customersQueued: 0,
    invoicesQueued: 0,
    errors: 0,
  };

  try {
    // Fetch all active QBO connections (one per org)
    const connections = await prisma.qboConnection.findMany({
      where: { isActive: true },
    });

    stats.orgsPolled = connections.length;

    // Process each org independently — one failure does not block others
    for (const connection of connections) {
      // Refresh QBO preferences (cached 23 hours)
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
      if (!connection.preferencesLastCheckedAt || connection.preferencesLastCheckedAt < twentyThreeHoursAgo) {
        try {
          await fetchAndCachePreferences(connection);
        } catch (prefError) {
          console.error(`[qbo-cdc] Failed to fetch preferences for org ${connection.orgId}:`, prefError);
          // Non-fatal — continue with CDC poll even if preferences fetch fails
        }
      }

      try {
        await pollOrgCdc(connection, stats);
      } catch (err) {
        stats.errors++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`CDC poll failed for org ${connection.orgId}:`, errorMessage);

        // Update cursor with failure status — do NOT advance lastPollAt
        await prisma.qboCdcCursor.upsert({
          where: { orgId: connection.orgId },
          create: {
            orgId: connection.orgId,
            connectionId: connection.id,
            lastPollAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
            lastPollStatus: "failed",
            lastPollError: errorMessage,
            entityTypes: "Customer,Invoice",
          },
          update: {
            lastPollStatus: "failed",
            lastPollError: errorMessage,
            // lastPollAt NOT updated — retry from same window on next run
          },
        });
      }
    }

    return NextResponse.json({ data: stats });
  } catch (err) {
    console.error("qbo-cdc cron error:", err);
    return NextResponse.json(
      { data: stats, error: "Cron execution error" },
      { status: 500 }
    );
  }
}

/**
 * Poll QBO CDC for a single org, enqueue discovered changes.
 */
async function pollOrgCdc(
  connection: QboConnection,
  stats: { customersQueued: number; invoicesQueued: number }
): Promise<void> {
  const now = new Date();

  // Get or create cursor — first run defaults to 4 hours ago
  let cursor = await prisma.qboCdcCursor.findUnique({
    where: { orgId: connection.orgId },
  });

  if (!cursor) {
    // First run: look back one poll interval (4 hours) to avoid large backlog
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    cursor = await prisma.qboCdcCursor.create({
      data: {
        orgId: connection.orgId,
        connectionId: connection.id,
        lastPollAt: fourHoursAgo,
        lastPollStatus: "success",
        entityTypes: "Customer,Invoice",
      },
    });
  }

  // Call QBO CDC endpoint for Customer and Invoice changes since lastPollAt
  const cdcResponse: QboCdcResponse = await cdcRequest(
    connection,
    ["Customer", "Invoice"],
    cursor.lastPollAt
  );

  // Parse entity lists from CDC response
  const customers = parseCdcEntities(cdcResponse, "Customer");
  const invoices = parseCdcEntities(cdcResponse, "Invoice");

  // Warn if entity count hits CDC max (1000) — signals possible truncation
  if (customers.length >= 1000 || invoices.length >= 1000) {
    console.warn(
      `CDC truncation warning for org ${connection.orgId}: customers=${customers.length}, invoices=${invoices.length}`
    );
  }

  // Enqueue customer:pull jobs with dedup check
  for (const cust of customers) {
    const qboId = (cust as { Id: string }).Id;

    // Dedup: skip if a pending/claimed job already exists for this qboEntityId
    const existing = await prisma.qboSyncJob.findFirst({
      where: {
        qboEntityId: qboId,
        entityType: "customer",
        status: { in: ["pending", "claimed"] },
      },
      select: { id: true },
    });
    if (existing) continue;

    const job = await enqueue(
      connection.orgId,
      connection.id,
      "customer",
      connection.orgId,
      "pull",
      5,
      { qboEntityId: qboId, realmId: connection.realmId }
    );
    await prisma.qboSyncJob.update({
      where: { id: job.id },
      data: { qboEntityId: qboId, qboRealmId: connection.realmId },
    });
    stats.customersQueued++;
  }

  // Enqueue invoice:pull jobs with dedup check
  for (const inv of invoices) {
    const qboId = (inv as { Id: string }).Id;

    const existing = await prisma.qboSyncJob.findFirst({
      where: {
        qboEntityId: qboId,
        entityType: "invoice",
        status: { in: ["pending", "claimed"] },
      },
      select: { id: true },
    });
    if (existing) continue;

    const job = await enqueue(
      connection.orgId,
      connection.id,
      "invoice",
      connection.orgId,
      "pull",
      5,
      { qboEntityId: qboId, realmId: connection.realmId }
    );
    await prisma.qboSyncJob.update({
      where: { id: job.id },
      data: { qboEntityId: qboId, qboRealmId: connection.realmId },
    });
    stats.invoicesQueued++;
  }

  // Advance cursor on success
  await prisma.qboCdcCursor.update({
    where: { orgId: connection.orgId },
    data: {
      lastPollAt: now,
      lastPollStatus: "success",
      lastPollError: null,
    },
  });
}

/**
 * Extract a named entity array from a QBO CDC response.
 * CDC responses nest entities: CDCResponse[].QueryResponse[].EntityName[]
 */
function parseCdcEntities(
  cdcResponse: QboCdcResponse,
  entityName: string
): unknown[] {
  const result: unknown[] = [];
  for (const cdcItem of cdcResponse.CDCResponse) {
    for (const qr of cdcItem.QueryResponse) {
      const entities = (qr as Record<string, unknown>)[entityName];
      if (Array.isArray(entities)) {
        result.push(...entities);
      }
    }
  }
  return result;
}
