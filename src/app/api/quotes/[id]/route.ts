import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSession, requireRole } from "@/lib/auth";
import { Role, QuoteStatus } from "@prisma/client";

// GET /api/quotes/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const quote = await prisma.quote.findFirst({
    where: { id, orgId },
    include: {
      customer: { select: { id: true, name: true, primaryEmail: true, primaryPhone: true } },
      site: { select: { id: true, name: true, address: true, city: true, state: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      lineItems: {
        include: { material: { select: { id: true, name: true, partNumber: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ data: quote });
}

// PUT /api/quotes/[id] - Update quote
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id, orgId } });
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Only allow editing DRAFT quotes
  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only edit DRAFT quotes" }, { status: 400 });
  }

  const body = await req.json();
  const { title, description, laborRate, materialMarkupPercent, validUntil, notes, terms, siteId } = body;

  const updated = await prisma.quote.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(laborRate !== undefined && { laborRate: laborRate || null }),
      ...(materialMarkupPercent !== undefined && { materialMarkupPercent: materialMarkupPercent || null }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(terms !== undefined && { terms: terms || null }),
      ...(siteId !== undefined && { siteId: siteId || null }),
    },
  });

  return NextResponse.json({ data: updated });
}

// DELETE /api/quotes/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id, orgId } });
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Only allow deleting DRAFT quotes
  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only delete DRAFT quotes" }, { status: 400 });
  }

  await prisma.quote.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
