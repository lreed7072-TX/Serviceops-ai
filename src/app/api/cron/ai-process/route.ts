import { NextRequest, NextResponse } from "next/server";
import { resetStaleAiLocks, claimAiBatch } from "@/lib/ai/ai-queue";
import { processAiJob } from "@/lib/ai/ai-engine";

export const maxDuration = 60;

/**
 * GET /api/cron/ai-process
 * Vercel Cron job — processes queued AI insight jobs every 2 minutes.
 * processAiJob handles completeAiJob/failAiJob internally, so we only
 * track stats here.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const stats = {
    staleReset: 0,
    claimed: 0,
    processed: 0,
    failed: 0,
    totalTokens: 0,
    durationMs: 0,
  };

  try {
    // Step 1: Reset stale locks
    stats.staleReset = await resetStaleAiLocks();

    // Step 2: Claim batch of pending jobs
    const jobs = await claimAiBatch(20);
    stats.claimed = jobs.length;

    // Step 3: Process each job sequentially, respecting Vercel timeout
    for (const job of jobs) {
      // Stop if we've been running longer than 50s (leave 10s buffer for cleanup)
      if (Date.now() - startTime > 50000) break;

      try {
        const result = await processAiJob(job);
        stats.processed++;
        stats.totalTokens += result.tokensUsed;
      } catch (err) {
        // processAiJob calls failAiJob internally before re-throwing
        stats.failed++;
        console.error(`[ai-process] Job ${job.id} failed:`, err);
      }
    }

    stats.durationMs = Date.now() - startTime;
    return NextResponse.json({ data: stats });
  } catch (err) {
    console.error("[ai-process] Cron error:", err);
    stats.durationMs = Date.now() - startTime;
    return NextResponse.json(
      { data: stats, error: "Cron execution error" },
      { status: 500 }
    );
  }
}
