import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, QuoteLineItemType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export const runtime = "nodejs";

/**
 * POST /api/opportunities/[id]/convert-to-quote
 * Convert an opportunity to a ServiceOps quote. SALES + ADMIN can convert.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // Only SALES and ADMIN can convert
    const roleError = requireRole(auth, [Role.ADMIN, Role.SALES]);
    if (roleError) return roleError;

    // Lookup the opportunity with relations
    const where: any = {
      id,
      orgId: auth.orgId,
    };

    // SALES can only convert own opportunities
    if (auth.role === Role.SALES) {
      where.createdByUserId = auth.userId;
    }

    const opportunity = await prisma.opportunity.findFirst({
      where,
      include: {
        customer: true,
        site: true,
        contact: true,
      },
    });

    if (!opportunity) {
      return jsonError("Opportunity not found.", 404);
    }

    // Check if already converted
    if (opportunity.convertedQuoteId) {
      return jsonError("Opportunity already converted to quote.", 400);
    }

    // Generate quote number: count existing quotes for org + 1, formatted as Q-XXXX
    const quoteCount = await prisma.quote.count({
      where: { orgId: auth.orgId },
    });
    const quoteNumber = `Q-${String(quoteCount + 1).padStart(4, "0")}`;

    // Build quote data
    const amount = opportunity.amount ? Number(opportunity.amount) : null;

    const quote = await prisma.quote.create({
      data: {
        orgId: auth.orgId,
        customerId: opportunity.customerId,
        siteId: opportunity.siteId || null,
        quoteNumber,
        status: "DRAFT",
        title: opportunity.name,
        description: opportunity.description || null,
        subtotal: amount != null ? new Decimal(amount) : new Decimal(0),
        total: amount != null ? new Decimal(amount) : new Decimal(0),
        createdByUserId: auth.userId,
        // Create a line item if opportunity has an amount
        ...(amount != null
          ? {
              lineItems: {
                create: {
                  orgId: auth.orgId,
                  itemType: QuoteLineItemType.SERVICE,
                  description: opportunity.name,
                  quantity: new Decimal(1),
                  unitPrice: new Decimal(amount),
                  totalPrice: new Decimal(amount),
                  sortOrder: 0,
                },
              },
            }
          : {}),
      },
    });

    // Update opportunity with the converted quote ID
    await prisma.opportunity.update({
      where: { id },
      data: { convertedQuoteId: quote.id },
    });

    return NextResponse.json(
      {
        data: {
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to convert opportunity to quote:", error);
    return jsonError("Failed to convert opportunity to quote", 500);
  }
}
