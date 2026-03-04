// Portal Quote Accept API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/portal/quotes/:id/accept
 * Accept a SENT quote (changes status to APPROVED)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authResult = await requirePortalAuth(request);
    if (authResult.error) return authResult.error;
    const { portal } = authResult;

    const quote = await prisma.quote.findFirst({
      where: {
        id,
        orgId: portal!.orgId,
        customerId: portal!.customerId,
      },
    });

    if (!quote) {
      return jsonError("Quote not found.", 404);
    }

    if (quote.status !== "SENT") {
      return jsonError(`Quote cannot be accepted from ${quote.status} status.`, 400);
    }

    // Check expiry
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      return jsonError("Quote has expired.", 400);
    }

    // Update quote status to APPROVED
    const updated = await prisma.quote.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedByName: portal!.customerName,
      },
    });

    return NextResponse.json({
      data: updated,
      message: "Quote accepted successfully.",
    });
  } catch (error) {
    console.error("Portal quote accept error:", error);
    return jsonError("Failed to accept quote", 500);
  }
}
