// Portal Quotes List API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

/**
 * GET /api/portal/quotes
 * List quotes for portal customer (SENT and APPROVED only)
 */
export async function GET(request: Request) {
  try {
    const authResult = await requirePortalAuth(request);
    if (authResult.error) return authResult.error;
    const { portal } = authResult;

    const quotes = await prisma.quote.findMany({
      where: {
        orgId: portal!.orgId,
        customerId: portal!.customerId,
        status: { in: ["SENT", "APPROVED"] },
      },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: quotes });
  } catch (error) {
    console.error("Portal quotes list error:", error);
    return jsonError("Failed to fetch quotes", 500);
  }
}
