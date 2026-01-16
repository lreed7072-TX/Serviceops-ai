// Quote/Estimate Management API
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { QuoteStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/quotes
 * List all quotes for the organization with search/filter
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as QuoteStatus | null;
  const customerId = searchParams.get("customerId");
  const search = searchParams.get("search") || "";

  // Build where clause
  const where: any = {
    orgId: auth.orgId,
  };

  // Filter by status
  if (status && Object.values(QuoteStatus).includes(status)) {
    where.status = status;
  }

  // Filter by customer
  if (customerId) {
    where.customerId = customerId;
  }

  // Search across title, description, quote number
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { quoteNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: true,
      site: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: {
          lineItems: true,
          workOrders: true,
          invoices: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: quotes });
}

/**
 * POST /api/quotes
 * Create a new quote
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  // Check permissions
  if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
    return jsonError("Only administrators can create quotes.", 403);
  }

  const body = await request.json();
  const {
    customerId,
    siteId,
    title,
    description,
    taxRate = 0,
    validUntil,
    notes,
    terms,
    lineItems = [],
  } = body;

  // Validate required fields
  if (!customerId || !title) {
    return jsonError("Customer and title are required.", 400);
  }

  // Verify customer belongs to org
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      orgId: auth.orgId,
    },
  });

  if (!customer) {
    return jsonError("Customer not found.", 404);
  }

  // Generate quote number (Q-YYYYMMDD-XXX)
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const lastQuote = await prisma.quote.findFirst({
    where: {
      orgId: auth.orgId,
      quoteNumber: { startsWith: `Q-${dateStr}` },
    },
    orderBy: { quoteNumber: "desc" },
  });

  let quoteNumber = `Q-${dateStr}-001`;
  if (lastQuote) {
    const lastNum = parseInt(lastQuote.quoteNumber.split("-")[2]);
    quoteNumber = `Q-${dateStr}-${String(lastNum + 1).padStart(3, "0")}`;
  }

  // Calculate totals from line items
  const subtotal = lineItems.reduce((sum: number, item: any) => {
    return sum + (item.totalPrice || 0);
  }, 0);

  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // Create quote with line items
  const quote = await prisma.quote.create({
    data: {
      orgId: auth.orgId,
      customerId,
      siteId: siteId || null,
      quoteNumber,
      status: QuoteStatus.DRAFT,
      title,
      description: description || null,
      subtotal,
      tax,
      taxRate,
      total,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes || null,
      terms: terms || "Quote valid for 30 days. Work to begin upon acceptance.",
      createdByUserId: auth.userId,
      lineItems: {
        create: lineItems.map((item: any, index: number) => ({
          orgId: auth.orgId,
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          materialId: item.materialId || null,
          sortOrder: index,
        })),
      },
    },
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

  return NextResponse.json({ data: quote }, { status: 201 });
}
