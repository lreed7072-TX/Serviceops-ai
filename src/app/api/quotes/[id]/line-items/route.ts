import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, QuoteStatus, QuoteLineItemType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Helper to recalculate quote totals
async function recalculateQuoteTotals(quoteId: string) {
  const lineItems = await prisma.quoteLineItem.findMany({ where: { quoteId } });
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  // For now, no tax calculation - can be added later
  const total = subtotal;

  await prisma.quote.update({
    where: { id: quoteId },
    data: { subtotal, tax: 0, total },
  });
}

// GET /api/quotes/[id]/line-items
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quoteId } = await params;
  const auth = await requireAuthSessionFirst();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  // Verify quote exists
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId } });
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const lineItems = await prisma.quoteLineItem.findMany({
    where: { quoteId },
    include: { material: { select: { id: true, name: true, partNumber: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ data: lineItems });
}

// POST /api/quotes/[id]/line-items - Add line item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quoteId } = await params;
  const auth = await requireAuthSessionFirst();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId } });
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only add items to DRAFT quotes" }, { status: 400 });
  }

  const body = await req.json();
  const { itemType, description, quantity, unitPrice, materialId } = body;

  if (!itemType || !description || quantity === undefined || unitPrice === undefined) {
    return NextResponse.json({ error: "itemType, description, quantity, and unitPrice required" }, { status: 400 });
  }

  if (!Object.values(QuoteLineItemType).includes(itemType)) {
    return NextResponse.json({ error: "Invalid itemType" }, { status: 400 });
  }

  const qty = Number(quantity);
  const price = Number(unitPrice);
  const totalPrice = qty * price;

  // Get max sortOrder
  const lastItem = await prisma.quoteLineItem.findFirst({
    where: { quoteId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (lastItem?.sortOrder ?? -1) + 1;

  const lineItem = await prisma.quoteLineItem.create({
    data: {
      orgId,
      quoteId,
      itemType,
      description,
      quantity: qty,
      unitPrice: price,
      totalPrice,
      materialId: materialId || null,
      sortOrder,
    },
    include: { material: { select: { id: true, name: true, partNumber: true } } },
  });

  await recalculateQuoteTotals(quoteId);

  return NextResponse.json({ data: lineItem }, { status: 201 });
}
