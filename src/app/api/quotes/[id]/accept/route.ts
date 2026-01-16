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
  if (quote.status === QuoteStatus.ACCEPTED) {
    return jsonError("Quote has already been accepted.", 400);
  }

  if (quote.status !== QuoteStatus.SENT && quote.status !== QuoteStatus.DRAFT) {
    return jsonError(`Quote cannot be accepted from ${quote.status} status.`, 400);
  }

  // Check if quote is expired
  if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
    return jsonError("Quote has expired.", 400);
  }

  // Generate work order number
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const lastWO = await prisma.workOrder.findFirst({
    where: {
      orgId: auth.orgId,
      workOrderNumber: { startsWith: `WO-${dateStr}` },
    },
    orderBy: { workOrderNumber: "desc" },
  });

  let workOrderNumber = `WO-${dateStr}-001`;
  if (lastWO && lastWO.workOrderNumber) {
    const lastNum = parseInt(lastWO.workOrderNumber.split("-")[2]);
    workOrderNumber = `WO-${dateStr}-${String(lastNum + 1).padStart(3, "0")}`;
  }

  // Create work order from quote
  const workOrder = await prisma.workOrder.create({
    data: {
      orgId: auth.orgId,
      customerId: quote.customerId,
      siteId: quote.siteId || quote.customerId, // Fallback to customer if no site
      quoteId: quote.id,
      title: quote.title,
      description: quote.description,
      status: WorkOrderStatus.OPEN,
      orderType: OrderType.WORK_ORDER,
      workOrderNumber,
    },
  });

  // Update quote status
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: QuoteStatus.ACCEPTED,
      acceptedAt: new Date(),
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
      message: `Work order ${workOrderNumber} created from quote ${quote.quoteNumber}`,
    },
  }, { status: 201 });
}
