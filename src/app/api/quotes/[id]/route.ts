// Individual Quote Management API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { QuoteStatus } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/quotes/:id
 * Get a single quote by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const quote = await prisma.quote.findFirst({
    where: {
      id,
      orgId: auth.orgId,
    },
    include: {
      customer: true,
      site: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
        include: {
          material: true,
        },
      },
      workOrders: {
        select: {
          id: true,
          workOrderNumber: true,
          status: true,
          createdAt: true,
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
    },
  });

  if (!quote) {
    return jsonError("Quote not found.", 404);
  }

  return NextResponse.json({ data: quote });
}

/**
 * PATCH /api/quotes/:id
 * Update a quote (only in DRAFT status)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Check permissions
  if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
    return jsonError("Only administrators can update quotes.", 403);
  }

  const body = await request.json();
  let {
    title,
    description,
    siteId,
    taxRate,
    validUntil,
    notes,
    terms,
    status,
    rejectionReason,
    lineItems,
  } = body;

  // Verify quote exists
  const existingQuote = await prisma.quote.findFirst({
    where: { id, orgId: auth.orgId },
  });

  if (!existingQuote) {
    return jsonError("Quote not found.", 404);
  }

  // Build update data
  const updateData: any = {};

  // For non-DRAFT quotes: only allow metadata changes (siteId, validUntil, notes, terms)
  // Block pricing/content edits (title, description, taxRate, lineItems)
  if (existingQuote.status !== QuoteStatus.DRAFT) {
    const hasActualContentChanges =
      (title !== undefined && title !== existingQuote.title) ||
      (description !== undefined && (description || null) !== existingQuote.description) ||
      (taxRate !== undefined && taxRate !== Number(existingQuote.taxRate));

    if (hasActualContentChanges) {
      return jsonError("Content edits are only allowed on DRAFT quotes. Change status to DRAFT first.", 400);
    }

    // Line items can only be modified on DRAFT quotes — silently ignore if resent unchanged
    if (lineItems !== undefined) {
      lineItems = undefined;
    }
  }

  // siteId can be updated on DRAFT or SENT quotes (needed before converting to WO)
  if (siteId !== undefined) {
    if (existingQuote.status !== QuoteStatus.DRAFT && existingQuote.status !== QuoteStatus.SENT) {
      return jsonError("Site can only be changed on DRAFT or SENT quotes.", 400);
    }
    updateData.siteId = siteId || null;
  }

  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (taxRate !== undefined) {
    updateData.taxRate = taxRate;
    // Recalculate tax and total if rate changes
    updateData.tax = existingQuote.subtotal.toNumber() * (taxRate / 100);
    updateData.total = existingQuote.subtotal.toNumber() + updateData.tax;
  }
  if (validUntil !== undefined) updateData.validUntil = validUntil ? new Date(validUntil) : null;
  if (notes !== undefined) updateData.notes = notes;
  if (terms !== undefined) updateData.terms = terms;

  // Status transitions
  if (status !== undefined) {
    if (status === QuoteStatus.SENT && existingQuote.status === QuoteStatus.DRAFT) {
      updateData.status = QuoteStatus.SENT;
      updateData.sentAt = new Date();
    } else if (status === QuoteStatus.REJECTED) {
      updateData.status = QuoteStatus.REJECTED;
      updateData.rejectedAt = new Date();
      if (rejectionReason) updateData.rejectionReason = rejectionReason;
    } else if (status === QuoteStatus.CANCELED) {
      updateData.status = QuoteStatus.CANCELED;
    } else if (status !== existingQuote.status) {
      return jsonError(`Invalid status transition from ${existingQuote.status} to ${status}.`, 400);
    }
  }

  // Update line items if provided (only on DRAFT — content check above already guards this)
  if (lineItems) {
    // Delete existing line items
    await prisma.quoteLineItem.deleteMany({
      where: { quoteId: id },
    });

    // Calculate new totals
    const subtotal = lineItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);
    const tax = subtotal * ((taxRate !== undefined ? taxRate : existingQuote.taxRate.toNumber()) / 100);
    const total = subtotal + tax;

    updateData.subtotal = subtotal;
    updateData.tax = tax;
    updateData.total = total;

    // Create new line items
    await prisma.quoteLineItem.createMany({
      data: lineItems.map((item: any, index: number) => ({
        orgId: auth.orgId,
        quoteId: id,
        itemType: item.itemType,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        materialId: item.materialId || null,
        sortOrder: index,
      })),
    });
  }

  // Update quote
  const quote = await prisma.quote.update({
    where: { id },
    data: updateData,
    include: {
      customer: true,
      site: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ data: quote });
}

/**
 * DELETE /api/quotes/:id
 * Delete a quote (only DRAFT quotes can be deleted)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Check permissions
  if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
    return jsonError("Only administrators can delete quotes.", 403);
  }

  // Verify quote exists
  const quote = await prisma.quote.findFirst({
    where: { id, orgId: auth.orgId },
  });

  if (!quote) {
    return jsonError("Quote not found.", 404);
  }

  // Can only delete DRAFT quotes
  if (quote.status !== QuoteStatus.DRAFT) {
    return jsonError("Can only delete DRAFT quotes. Cancel instead.", 400);
  }

  // Delete quote (will cascade to line items)
  await prisma.quote.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
