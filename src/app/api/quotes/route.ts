import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, QuoteStatus } from "@prisma/client";

// GET /api/quotes - List quotes
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");

  const where: any = { orgId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      lineItems: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: quotes });
}

// POST /api/quotes - Create quote
export async function POST(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId, userId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await req.json();
  const { customerId, siteId, title, description, validUntil, laborRate, materialMarkupPercent } = body;

  if (!customerId || !title) {
    return NextResponse.json({ error: "Customer and title required" }, { status: 400 });
  }

  // Generate quote number
  let quote: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.quote.findFirst({
      where: { orgId, quoteNumber: { startsWith: "QT-" } },
      select: { quoteNumber: true },
      orderBy: { createdAt: "desc" },
    });
    const match = last?.quoteNumber?.match(/^QT-(\d+)$/);
    const nextNum = (match ? parseInt(match[1], 10) : 0) + 1 + attempt;
    const quoteNumber = `QT-${String(nextNum).padStart(5, "0")}`;

    try {
      quote = await prisma.quote.create({
        data: {
          orgId,
          customerId,
          siteId: siteId || null,
          quoteNumber,
          title,
          description: description || null,
          status: QuoteStatus.DRAFT,
          validUntil: validUntil ? new Date(validUntil) : null,
          laborRate: laborRate || null,
          materialMarkupPercent: materialMarkupPercent || null,
          createdByUserId: userId,
        },
      });
      break;
    } catch (err: any) {
      if (err?.code !== "P2002" || attempt === 4) throw err;
    }
  }

  return NextResponse.json({ data: quote }, { status: 201 });
}
