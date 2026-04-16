// Quote Acceptance API - Converts quote to work order
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { QuoteStatus, WorkOrderStatus, OrderType } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/quotes/:id/accept
 * Accept a quote and create a work order
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: quoteId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Check permissions
  if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
    return jsonError("Only administrators can accept quotes.", 403);
  }

  // Fetch quote with line items
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      orgId: auth.orgId,
    },
    include: {
      lineItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!quote) {
    return jsonError("Quote not found.", 404);
  }

  // Verify quote can be accepted
  if (quote.status === QuoteStatus.APPROVED) {
    return jsonError("Quote has already been accepted.", 400);
  }

  if (quote.status !== QuoteStatus.SENT && quote.status !== QuoteStatus.DRAFT) {
    return jsonError(`Quote cannot be accepted from ${quote.status} status.`, 400);
  }

  // Check if quote is expired
  if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
    return jsonError("Quote has expired.", 400);
  }

  // siteId is required on WorkOrder — cannot convert without one
  if (!quote.siteId) {
    return jsonError("Cannot convert quote without a site. Edit the quote to add a site first.", 400);
  }

  // Generate sequential work order number (WO00001 format)
  const prefix = "WO";
  let workOrder: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.workOrder.findFirst({
      where: { orgId: auth.orgId, orderType: OrderType.WORK_ORDER, workOrderNumber: { startsWith: prefix } },
      select: { workOrderNumber: true },
      orderBy: { createdAt: "desc" },
    });
    const match = last?.workOrderNumber?.match(new RegExp(`^${prefix}(\\d+)$`));
    const nextNum = (match ? parseInt(match[1], 10) : 0) + 1 + attempt;
    const workOrderNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;

    try {
      workOrder = await prisma.workOrder.create({
        data: {
          orgId: auth.orgId,
          customerId: quote.customerId,
          siteId: quote.siteId,
          quoteId: quote.id,
          title: quote.title,
          description: quote.description,
          status: WorkOrderStatus.OPEN,
          orderType: OrderType.WORK_ORDER,
          workOrderNumber,
        },
      });
      break;
    } catch (err: any) {
      if (err?.code !== "P2002" || attempt === 4) throw err;
    }
  }

  if (!workOrder) {
    return jsonError("Failed to generate work order number. Please try again.", 500);
  }

  // Update quote status
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: QuoteStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

  // Return work order with quote reference
  const completeWorkOrder = await prisma.workOrder.findUnique({
    where: { id: workOrder.id },
    include: {
      customer: true,
      site: true,
      quote: {
        include: {
          lineItems: true,
        },
      },
    },
  });

  return NextResponse.json({
    data: {
      workOrder: completeWorkOrder,
      message: `Work order ${workOrder.workOrderNumber} created from quote ${quote.quoteNumber}`,
    },
  }, { status: 201 });
}
