import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, QuoteStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Helper to recalculate quote totals
async function recalculateQuoteTotals(quoteId: string) {
  const lineItems = await prisma.quoteLineItem.findMany({ where: { quoteId } });
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const total = subtotal;
  await prisma.quote.update({
    where: { id: quoteId },
    data: { subtotal: new Decimal(subtotal), total: new Decimal(total) },
  });
}

// PUT /api/quotes/[id]/line-items/[itemId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: quoteId, itemId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId: auth.orgId } });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only edit items on DRAFT quotes" }, { status: 400 });
  }

  const item = await prisma.quoteLineItem.findFirst({ where: { id: itemId, quoteId } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const body = await req.json();
  const { description, quantity, unitPrice, sortOrder } = body;

  const newQty = quantity !== undefined ? new Decimal(quantity) : item.quantity;
  const newPrice = unitPrice !== undefined ? new Decimal(unitPrice) : item.unitPrice;
  const totalPrice = newQty.mul(newPrice);

  const updated = await prisma.quoteLineItem.update({
    where: { id: itemId },
    data: {
      description: description ?? item.description,
      quantity: newQty,
      unitPrice: newPrice,
      totalPrice,
      sortOrder: sortOrder ?? item.sortOrder,
    },
  });

  await recalculateQuoteTotals(quoteId);
  return NextResponse.json({ data: updated });
}

// DELETE /api/quotes/[id]/line-items/[itemId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: quoteId, itemId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId: auth.orgId } });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only delete items from DRAFT quotes" }, { status: 400 });
  }

  const item = await prisma.quoteLineItem.findFirst({ where: { id: itemId, quoteId } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.quoteLineItem.delete({ where: { id: itemId } });
  await recalculateQuoteTotals(quoteId);

  return NextResponse.json({ success: true });
}
