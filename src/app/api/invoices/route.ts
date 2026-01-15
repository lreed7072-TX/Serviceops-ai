import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { InvoiceStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/invoices
 * List all invoices for the org
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as InvoiceStatus | null;
  const customerId = searchParams.get("customerId");
  const workOrderId = searchParams.get("workOrderId");

  const invoices = await prisma.invoice.findMany({
    where: {
      orgId: authResult.auth.orgId,
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(workOrderId && { workOrderId }),
    },
    include: {
      customer: {
        select: { id: true, name: true },
      },
      site: {
        select: { id: true, name: true },
      },
      workOrder: {
        select: { id: true, title: true, workOrderNumber: true },
      },
      _count: {
        select: { lineItems: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: invoices });
}

/**
 * POST /api/invoices
 * Create a new invoice
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson(request);
  if (!body?.customerId || !body?.title) {
    return jsonError("customerId and title are required.", 400);
  }

  // Generate invoice number (simple incrementing)
  const lastInvoice = await prisma.invoice.findFirst({
    where: { orgId: authResult.auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  const nextNumber = lastInvoice 
    ? parseInt(lastInvoice.invoiceNumber.replace(/\D/g, "")) + 1 
    : 1;
  const invoiceNumber = `INV-${String(nextNumber).padStart(6, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      orgId: authResult.auth.orgId,
      customerId: body.customerId,
      siteId: body.siteId || null,
      workOrderId: body.workOrderId || null,
      quoteId: body.quoteId || null,
      invoiceNumber,
      status: InvoiceStatus.DRAFT,
      title: body.title,
      description: body.description || null,
      subtotal: 0,
      tax: 0,
      taxRate: body.taxRate || 0,
      total: 0,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      notes: body.notes || null,
      terms: body.terms || null,
      createdByUserId: authResult.auth.userId,
    },
    include: {
      customer: true,
      site: true,
      workOrder: true,
      lineItems: true,
    },
  });

  return NextResponse.json({ data: invoice }, { status: 201 });
}
