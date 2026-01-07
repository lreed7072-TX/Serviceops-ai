import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSession, requireRole } from "@/lib/auth";
import { Role, QuoteStatus, OrderType, WorkOrderStatus, ExecutionMode, WorkPackageType } from "@prisma/client";

// POST /api/quotes/[id]/actions - Perform action on quote
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quoteId } = await params;
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId, userId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, orgId },
    include: { lineItems: true },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const body = await req.json();
  const { action, approvedByName, rejectionReason, orderType } = body;

  switch (action) {
    case "send": {
      if (quote.status !== QuoteStatus.DRAFT) {
        return NextResponse.json({ error: "Can only send DRAFT quotes" }, { status: 400 });
      }
      if (quote.lineItems.length === 0) {
        return NextResponse.json({ error: "Cannot send quote with no line items" }, { status: 400 });
      }
      const updated = await prisma.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.SENT, sentAt: new Date() },
      });
      return NextResponse.json({ data: updated });
    }

    case "approve": {
      if (quote.status !== QuoteStatus.SENT) {
        return NextResponse.json({ error: "Can only approve SENT quotes" }, { status: 400 });
      }
      const updated = await prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.APPROVED,
          approvedAt: new Date(),
          approvedByName: approvedByName || null,
        },
      });
      return NextResponse.json({ data: updated });
    }

    case "reject": {
      if (quote.status !== QuoteStatus.SENT) {
        return NextResponse.json({ error: "Can only reject SENT quotes" }, { status: 400 });
      }
      const updated = await prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: rejectionReason || null,
        },
      });
      return NextResponse.json({ data: updated });
    }

    case "convert": {
      if (quote.status !== QuoteStatus.APPROVED) {
        return NextResponse.json({ error: "Can only convert APPROVED quotes" }, { status: 400 });
      }

      const targetOrderType = orderType || OrderType.WORK_ORDER;
      const prefix = targetOrderType === OrderType.SALES_ORDER ? "SO" : targetOrderType === OrderType.PROJECT ? "PJ" : "WO";

      // Generate order number
      let workOrder: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const last = await prisma.workOrder.findFirst({
          where: { orgId, orderType: targetOrderType, workOrderNumber: { startsWith: prefix } },
          select: { workOrderNumber: true },
          orderBy: { createdAt: "desc" },
        });
        const match = last?.workOrderNumber?.match(new RegExp(`^${prefix}(\\d+)$`));
        const nextNum = (match ? parseInt(match[1], 10) : 0) + 1 + attempt;
        const workOrderNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;

        try {
          workOrder = await prisma.workOrder.create({
            data: {
              orgId,
              workOrderNumber,
              orderType: targetOrderType,
              customerId: quote.customerId,
              siteId: quote.siteId!,
              title: quote.title,
              description: quote.description,
              status: WorkOrderStatus.OPEN,
              executionMode: ExecutionMode.UNIFIED,
            },
          });
          break;
        } catch (err: any) {
          if (err?.code !== "P2002" || attempt === 4) throw err;
        }
      }

      if (!workOrder) {
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
      }

      // Create default package
      await prisma.workPackage.create({
        data: {
          orgId,
          workOrderId: workOrder.id,
          packageType: WorkPackageType.MECH_ELEC_UNIFIED,
          name: "Mech/Electrical Unified",
        },
      });

      // Mark quote as converted
      await prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.CONVERTED,
          convertedToOrderId: workOrder.id,
          convertedToOrderType: targetOrderType,
        },
      });

      return NextResponse.json({ data: { quote: { status: QuoteStatus.CONVERTED }, workOrder } });
    }

    case "revert_to_draft": {
      if (quote.status !== QuoteStatus.SENT) {
        return NextResponse.json({ error: "Can only revert SENT quotes to draft" }, { status: 400 });
      }
      const updated = await prisma.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.DRAFT, sentAt: null },
      });
      return NextResponse.json({ data: updated });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
