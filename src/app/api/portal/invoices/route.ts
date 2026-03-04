// Portal Invoices List API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

/**
 * GET /api/portal/invoices
 * List invoices for portal customer (SENT, PAID, OVERDUE only)
 */
export async function GET(request: Request) {
  try {
    const authResult = await requirePortalAuth(request);
    if (authResult.error) return authResult.error;
    const { portal } = authResult;

    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: portal!.orgId,
        customerId: portal!.customerId,
        status: { in: ["SENT", "PAID", "OVERDUE"] },
      },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: invoices });
  } catch (error) {
    console.error("Portal invoices list error:", error);
    return jsonError("Failed to fetch invoices", 500);
  }
}
