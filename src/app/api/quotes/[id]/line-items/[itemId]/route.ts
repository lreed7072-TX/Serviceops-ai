import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, QuoteStatus } from "@prisma/client";

// Helper to recalculate quote totals
async function recalculateQuoteTotals(quoteId: string) {
  const lineItems = await prisma.quoteLineItem.findMany({ where: { quoteId } });
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const total = subtotal;
  await prisma.quote.update({
    where: { id: quoteId },
    data: { subtotal, tax: 0, total },
  });
}

// PUT /api/quotes/[id]/line-items/[itemId] - Update line item
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: quoteId, itemId } = await params;
  const auth = await requireAuthSessionFirst();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId } });
  if (!quote || quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Quote not found or not editable" }, { status: 404 });
  }

  const lineItem = await prisma.quoteLineItem.findFirst({ where: { id: itemId, quoteId } });
  if (!lineItem) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const body = await req.json();
  const { description, quantity, unitPrice } = body;

  const qty = quantity !== undefined ? Number(quantity) : Number(lineItem.quantity);
  const price = unitPrice !== undefined ? Number(unitPrice) : Number(lineItem.unitPrice);
  const totalPrice = qty * price;

  const updated = await prisma.quoteLineItem.update({
    where: { id: itemId },
    data: {
      ...(description !== undefined && { description }),
      quantity: qty,
      unitPrice: price,
      totalPrice,
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
  const auth = await requireAuthSessionFirst();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId } });
  if (!quote || quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Quote not found or not editable" }, { status: 404 });
  }

  const lineItem = await prisma.quoteLineItem.findFirst({ where: { id: itemId, quoteId } });
  if (!lineItem) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  await prisma.quoteLineItem.delete({ where: { id: itemId } });
  await recalculateQuoteTotals(quoteId);

  return NextResponse.json({ success: true });
}
