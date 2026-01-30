import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/server-auth";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

/**
 * POST /api/quotes/[id]/duplicate
 * Create a copy of an existing quote
 * Copies all line items and sets status to DRAFT
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthSessionFirst();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    requireRole(session.user, ["ADMIN", "DISPATCHER"]);

    const resolvedParams = await context.params;
    const quoteId = resolvedParams.id;

    // Get original quote with line items
    const originalQuote = await prisma.quote.findUnique({
      where: { 
        id: quoteId,
        organizationId: session.user.organizationId 
      },
      include: {
        lineItems: {
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    if (!originalQuote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Generate new quote number
    const latestQuote = await prisma.quote.findFirst({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      select: { quoteNumber: true }
    });

    let nextNumber = 1000;
    if (latestQuote?.quoteNumber) {
      const match = latestQuote.quoteNumber.match(/QUOTE-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    const newQuoteNumber = `QUOTE-${nextNumber.toString().padStart(5, "0")}`;

    // Create duplicate quote
    const duplicateQuote = await prisma.quote.create({
      data: {
        organizationId: session.user.organizationId,
        quoteNumber: newQuoteNumber,
        title: `${originalQuote.title} (Copy)`,
        description: originalQuote.description,
        customerId: originalQuote.customerId,
        siteId: originalQuote.siteId,
        status: QuoteStatus.DRAFT,
        subtotal: originalQuote.subtotal,
        tax: originalQuote.tax,
        taxRate: originalQuote.taxRate,
        total: originalQuote.total,
        validUntil: originalQuote.validUntil,
        notes: originalQuote.notes,
        terms: originalQuote.terms,
        createdById: session.user.id,
        // Don't copy: sentAt, approvedAt, approvedByName, rejectedAt, rejectionReason
        lineItems: {
          create: originalQuote.lineItems.map((item, index) => ({
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            sortOrder: index,
            organizationId: session.user.organizationId,
          }))
        }
      },
      include: {
        customer: true,
        site: true,
        lineItems: {
          orderBy: { sortOrder: "asc" }
        },
        createdBy: {
          select: { name: true }
        }
      }
    });

    return NextResponse.json({
      data: duplicateQuote,
      message: `Quote duplicated as ${newQuoteNumber}`
    });
  } catch (error) {
    console.error("Failed to duplicate quote:", error);
    return NextResponse.json(
      { error: "Failed to duplicate quote" },
      { status: 500 }
    );
  }
}
