// Portal Invoice Detail API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requirePortalAuth } from "@/lib/portal-auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/portal/invoices/:id
 * View single invoice with line items
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const authResult = await requirePortalAuth(request);
    if (authResult.error) return authResult.error;
    const { portal } = authResult;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        orgId: portal!.orgId,
        customerId: portal!.customerId,
        status: { in: ["SENT", "PAID", "OVERDUE"] },
      },
      include: {
        site: { select: { id: true, name: true } },
        lineItems: { orderBy: { sortOrder: "asc" } },
        workOrder: {
          select: { id: true, title: true, workOrderNumber: true },
        },
      },
    });

    if (!invoice) {
      return jsonError("Invoice not found.", 404);
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    console.error("Portal invoice detail error:", error);
    return jsonError("Failed to fetch invoice", 500);
  }
}
