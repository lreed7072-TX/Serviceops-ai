import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSession, requireRole } from "@/lib/auth";
import { Role, QuoteStatus } from "@prisma/client";

// GET /api/quotes - List quotes
export async function GET(req: NextRequest) {
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId } = auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as QuoteStatus | null;
  const customerId = searchParams.get("customerId");

  const where: any = { orgId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: quotes });
}

// POST /api/quotes - Create quote
export async function POST(req: NextRequest) {
  const auth = await requireAuthSession();
  if ("status" in auth) return auth;
  const { orgId, userId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await req.json();
  const { customerId, siteId, title, description, laborRate, materialMarkupPercent, validUntil, notes, terms } = body;

  if (!customerId || !title) {
    return NextResponse.json({ error: "customerId and title are required" }, { status: 400 });
  }

  // Verify customer exists
  const customer = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Generate quote number
  let quote: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.quote.findFirst({
      where: { orgId, quoteNumber: { startsWith: "QT" } },
      select: { quoteNumber: true },
      orderBy: { createdAt: "desc" },
    });

    const lastNum = last?.quoteNumber?.match(/^QT(\d+)$/)?.[1];
    const nextNum = (lastNum ? parseInt(lastNum, 10) : 0) + 1 + attempt;
    const quoteNumber = `QT${String(nextNum).padStart(5, "0")}`;

    try {
      quote = await prisma.quote.create({
        data: {
          orgId,
          quoteNumber,
          customerId,
          siteId: siteId || null,
          title,
          description: description || null,
          laborRate: laborRate || null,
          materialMarkupPercent: materialMarkupPercent || null,
          validUntil: validUntil ? new Date(validUntil) : null,
          notes: notes || null,
          terms: terms || null,
          createdByUserId: userId,
        },
        include: {
          customer: { select: { id: true, name: true } },
          site: { select: { id: true, name: true } },
        },
      });
      break;
    } catch (err: any) {
      if (err?.code !== "P2002" || attempt === 4) throw err;
    }
  }

  return NextResponse.json({ data: quote }, { status: 201 });
}
