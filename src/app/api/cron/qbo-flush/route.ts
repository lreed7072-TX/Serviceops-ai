import { NextRequest, NextResponse } from "next/server";
import { claimBatch, complete, fail, resetStaleLocks } from "@/lib/qbo/qbo-queue";
import {
  syncCustomerToQbo,
  syncInvoiceToQbo,
  syncMaterialToQbo,
  syncLaborRateToQbo,
  syncQuoteToQbo,
  processPaymentJob,
} from "@/lib/qbo/qbo-sync";
import type { QboSyncJob } from "@prisma/client";

/**
 * GET /api/cron/qbo-flush
 * Vercel Cron job — processes up to 30 queued QBO sync jobs every 5 minutes.
 * Secured via CRON_SECRET header (same pattern as generate-pms).
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = { resetStale: 0, processed: 0, succeeded: 0, failed: 0 };

  try {
    // Step 1: Reset stale locks (jobs claimed >120s ago)
    stats.resetStale = await resetStaleLocks(120);

    // Step 2: Claim up to 30 pending jobs
    const jobs = await claimBatch(30);
    stats.processed = jobs.length;

    // Step 3: Process each job sequentially
    for (const job of jobs) {
      try {
        await dispatchJob(job);
        await complete(job.id);
        stats.succeeded++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await fail(job.id, errorMessage);
        stats.failed++;
      }
    }

    return NextResponse.json({ data: stats });
  } catch (err) {
    console.error("qbo-flush cron error:", err);
    return NextResponse.json({ data: stats, error: "Cron execution error" }, { status: 500 });
  }
}

/**
 * Dispatch a sync job to the appropriate handler based on entityType + action.
 */
async function dispatchJob(job: QboSyncJob): Promise<void> {
  const payload = (job.payload as Record<string, unknown>) || {};

  switch (`${job.entityType}:${job.action}`) {
    case "customer:push": {
      const custResult = await syncCustomerToQbo(job.orgId, job.entityId);
      if (!custResult.success) throw new Error(custResult.error || "Customer sync failed");
      break;
    }

    case "invoice:push": {
      const invResult = await syncInvoiceToQbo(job.orgId, job.entityId);
      if (!invResult.success) throw new Error(invResult.error || "Invoice sync failed");
      break;
    }

    case "invoice:email": {
      // Email is handled directly via the send-invoice-email endpoint — not through cron
      throw new Error("Invoice email should use the send-invoice-email endpoint directly");
    }

    case "item:push": {
      if (payload.sourceType === "laborRate") {
        const lrResult = await syncLaborRateToQbo(job.orgId, job.entityId);
        if (!lrResult.success) throw new Error(lrResult.error || "Labor rate sync failed");
      } else {
        const matResult = await syncMaterialToQbo(job.orgId, job.entityId);
        if (!matResult.success) throw new Error(matResult.error || "Material sync failed");
      }
      break;
    }

    case "estimate:push": {
      const estResult = await syncQuoteToQbo(job.orgId, job.entityId);
      if (!estResult.success) throw new Error(estResult.error || "Estimate sync failed");
      break;
    }

    case "payment:pull": {
      const qboPaymentId = (payload.qboEntityId as string) || job.qboEntityId;
      const realmId = (payload.realmId as string) || job.qboRealmId;
      if (!qboPaymentId || !realmId) {
        throw new Error("Payment job missing qboEntityId or realmId in payload");
      }
      const payResult = await processPaymentJob(job.orgId, qboPaymentId, realmId);
      if (!payResult.success) throw new Error(payResult.error || "Payment processing failed");
      break;
    }

    default: {
      console.warn(`Unknown job type: ${job.entityType}:${job.action}`, job.id);
      throw new Error(`Unhandled job type: ${job.entityType}:${job.action}`);
    }
  }
}
