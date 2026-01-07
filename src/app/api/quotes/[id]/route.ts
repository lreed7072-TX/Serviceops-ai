import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, QuoteStatus } from "@prisma/client";

// GET /api/quotes/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const quote = await prisma.quote.findFirst({
    where: { id, orgId: auth.orgId },
    include: {
      customer: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: quote });
}

// PUT /api/quotes/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id, orgId: auth.orgId } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only edit DRAFT quotes" }, { status: 400 });
  }

  const body = await req.json();
  const { title, description, siteId, validUntil, laborRate, materialMarkupPercent, notes, terms } = body;

  const updated = await prisma.quote.update({
    where: { id },
    data: {
      title: title ?? quote.title,
      description: description !== undefined ? description : quote.description,
      siteId: siteId !== undefined ? siteId : quote.siteId,
      validUntil: validUntil ? new Date(validUntil) : quote.validUntil,
      laborRate: laborRate !== undefined ? laborRate : quote.laborRate,
      materialMarkupPercent: materialMarkupPercent !== undefined ? materialMarkupPercent : quote.materialMarkupPercent,
      notes: notes !== undefined ? notes : quote.notes,
      terms: terms !== undefined ? terms : quote.terms,
    },
  });

  return NextResponse.json({ data: updated });
}

// DELETE /api/quotes/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const quote = await prisma.quote.findFirst({ where: { id, orgId: auth.orgId } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.status !== QuoteStatus.DRAFT) {
    return NextResponse.json({ error: "Can only delete DRAFT quotes" }, { status: 400 });
  }

  await prisma.quoteLineItem.deleteMany({ where: { quoteId: id } });
  await prisma.quote.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
