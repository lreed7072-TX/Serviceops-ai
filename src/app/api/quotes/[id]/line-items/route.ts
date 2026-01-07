import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, QuoteStatus, QuoteLineItemType } from "@prisma/client";
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

// GET /api/quotes/[id]/line-items
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quoteId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId: auth.orgId } });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const lineItems = await prisma.quoteLineItem.findMany({
    where: { quoteId },
    include: { material: { select: { id: true, name: true, partNumber: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ data: lineItems });
}

// POST /api/quotes/[id]/line-items
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: quoteId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, orgId: auth.orgId } });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only add items to DRAFT quotes" }, { status: 400 });
  }

  const body = await req.json();
  const { itemType, description, quantity, unitPrice, materialId } = body;

  if (!itemType || !description || quantity === undefined || unitPrice === undefined) {
    return NextResponse.json({ error: "itemType, description, quantity, unitPrice required" }, { status: 400 });
  }

  const lastItem = await prisma.quoteLineItem.findFirst({
    where: { quoteId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (lastItem?.sortOrder || 0) + 1;

  const totalPrice = new Decimal(quantity).mul(new Decimal(unitPrice));

  const lineItem = await prisma.quoteLineItem.create({
    data: {
      orgId: auth.orgId,
      quoteId,
      itemType: itemType as QuoteLineItemType,
      description,
      quantity: new Decimal(quantity),
      unitPrice: new Decimal(unitPrice),
      totalPrice,
      materialId: materialId || null,
      sortOrder,
    },
  });

  await recalculateQuoteTotals(quoteId);

  return NextResponse.json({ data: lineItem }, { status: 201 });
}
