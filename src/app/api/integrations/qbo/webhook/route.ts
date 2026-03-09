import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/qbo/qbo-client";
import { enqueue } from "@/lib/qbo/qbo-queue";
import { prisma } from "@/lib/prisma";

/**
 * Entity name → entityType mapping (lowercase for queue).
 */
const ENTITY_TYPE_MAP: Record<string, string> = {
  Payment: "payment",
  Invoice: "invoice",
  Customer: "customer",
  Item: "item",
  Estimate: "estimate",
};

/**
 * Determine queue action based on entity name and QBO operation.
 * - Payment events: always "pull" (we receive payment info from QBO)
 * - Create on Customer/Item/Estimate: "push" (inbound create)
 * - Update/Delete: "pull" (fetch latest from QBO)
 */
function mapAction(entityName: string, operation: string): string {
  if (entityName === "Payment") return "pull";
  if (operation === "Create") return "push";
  return "pull";
}

// POST /api/integrations/qbo/webhook
// Thin dispatcher: validates signature, parses payload, deduplicates, enqueues to QboSyncJob, returns 200 immediately.
// Does NOT call any QBO API functions — only DB reads and writes.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("intuit-signature");
  const rawBody = await req.text();

  // Verify webhook signature if verifier token is configured
  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (verifierToken && signature) {
    const valid = verifyWebhookSignature(rawBody, signature, verifierToken);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }
  }

  // Parse JSON — on parse error, return 200 (never return non-200 to QBO)
  let payload: {
    eventNotifications?: Array<{
      realmId: string;
      dataChangeEvent?: {
        entities: Array<{
          name: string;
          id: string;
          operation: string;
        }>;
      };
    }>;
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("QBO webhook: malformed JSON payload");
    return NextResponse.json({ ok: true });
  }

  if (!payload.eventNotifications) {
    return NextResponse.json({ ok: true });
  }

  try {
    for (const notification of payload.eventNotifications) {
      const realmId = notification.realmId;
      const entities = notification.dataChangeEvent?.entities || [];

      // Find the QboConnection by realmId
      const connection = await prisma.qboConnection.findFirst({
        where: { realmId, isActive: true },
        select: { id: true, orgId: true },
      });

      if (!connection) continue;

      for (const entity of entities) {
        const entityType = ENTITY_TYPE_MAP[entity.name];
        if (!entityType) continue; // Unknown entity type — skip

        const action = mapAction(entity.name, entity.operation);

        // Dedup check: skip if there's already a pending/claimed job for this QBO entity
        const existing = await prisma.qboSyncJob.findFirst({
          where: {
            qboEntityId: entity.id,
            entityType,
            status: { in: ["pending", "claimed"] },
          },
          select: { id: true },
        });

        if (existing) continue; // Already queued

        // Enqueue the job — use connection.orgId as placeholder entityId
        // (the actual ServiceOps entity lookup happens during cron processing)
        const job = await enqueue(
          connection.orgId,
          connection.id,
          entityType,
          connection.orgId, // placeholder entityId
          action,
          5,
          { qboEntityId: entity.id, realmId: notification.realmId, operation: entity.operation }
        );

        // Set qboEntityId and qboRealmId for dedup on subsequent webhook deliveries
        await prisma.qboSyncJob.update({
          where: { id: job.id },
          data: { qboEntityId: entity.id, qboRealmId: notification.realmId },
        });
      }
    }
  } catch (err) {
    // Log but return 200 — never return non-200 to QBO to prevent infinite retries
    console.error("QBO webhook processing error:", err);
  }

  return NextResponse.json({ ok: true });
}

// GET /api/integrations/qbo/webhook
// QBO sends a GET to verify the webhook endpoint during setup
export async function GET() {
  return NextResponse.json({ status: "active" });
}
