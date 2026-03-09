import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Map common QBO error substrings to actionable resolution hints
const RESOLUTION_HINTS: Array<{ pattern: string; hint: string }> = [
  { pattern: "Business Validation Error", hint: "Check required fields — the entity may be missing a required QBO field like DisplayName or AccountRef." },
  { pattern: "Stale Object Error", hint: "The record was modified in QBO since last sync. Re-trigger the sync to fetch the latest version and retry." },
  { pattern: "Duplicate Name Exists", hint: "A QBO entity with this name already exists. Check QBO for duplicates or rename the ServiceOps record." },
  { pattern: "Account mapping required", hint: "Configure Chart of Accounts mapping in QBO Settings before syncing financial transactions." },
  { pattern: "token refresh failed", hint: "QBO connection may have expired. Reconnect to QuickBooks in Settings > Integrations." },
  { pattern: "invalid_grant", hint: "QBO refresh token has expired. Disconnect and reconnect to QuickBooks in Settings > Integrations." },
  { pattern: "Rate Limit", hint: "QBO API rate limit reached. The sync will automatically retry on the next cron cycle." },
  { pattern: "No active QBO connection", hint: "Connect to QuickBooks in Settings > Integrations." },
  { pattern: "not found", hint: "The referenced entity may have been deleted in QBO. Check QBO and re-create if needed." },
];

function getResolutionHint(errorMessage: string | null): string | null {
  if (!errorMessage) return null;
  for (const { pattern, hint } of RESOLUTION_HINTS) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return hint;
    }
  }
  return "Review the error message and check the corresponding record in both ServiceOps and QBO.";
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "failed";
  const entityType = url.searchParams.get("entityType") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const where: Record<string, unknown> = { orgId, status };
  if (entityType) where.entityType = entityType;

  const [logs, total] = await Promise.all([
    prisma.qboSyncLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true, entityType: true, entityId: true, qboEntityId: true,
        action: true, status: true, errorMessage: true, metadata: true, createdAt: true,
      },
    }),
    prisma.qboSyncLog.count({ where }),
  ]);

  const logsWithHints = logs.map((log) => ({
    ...log,
    resolutionHint: getResolutionHint(log.errorMessage),
  }));

  return NextResponse.json({ data: logsWithHints, total, limit, offset });
}
