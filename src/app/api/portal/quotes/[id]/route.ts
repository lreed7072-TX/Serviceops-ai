// Portal Quote Detail API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/portal/quotes/:id
 * View single quote with line items
 */
export async function GET(request: Request, { params }: RouteParams) {
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
        status: { in: ["SENT", "APPROVED"] },
      },
      include: {
        site: { select: { id: true, name: true } },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!quote) {
      return jsonError("Quote not found.", 404);
    }

    return NextResponse.json({ data: quote });
  } catch (error) {
    console.error("Portal quote detail error:", error);
    return jsonError("Failed to fetch quote", 500);
  }
}
