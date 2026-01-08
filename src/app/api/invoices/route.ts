import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, InvoiceStatus } from "@prisma/client";

// GET /api/invoices - List invoices
export async function GET(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const workOrderId = searchParams.get("workOrderId");

  const where: any = { orgId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (workOrderId) where.workOrderId = workOrderId;

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      workOrder: { select: { id: true, workOrderNumber: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: invoices });
}

// POST /api/invoices - Create invoice
export async function POST(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId, userId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await req.json();
  const {
    customerId,
    siteId,
    workOrderId,
    quoteId,
    title,
    description,
    taxRate,
    dueDate,
    notes,
    terms,
  } = body;

  if (!customerId || !title) {
    return NextResponse.json(
      { error: "Customer and title required" },
      { status: 400 }
    );
  }

  // Generate invoice number
  let invoice: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.invoice.findFirst({
      where: { orgId, invoiceNumber: { startsWith: "INV-" } },
      select: { invoiceNumber: true },
      orderBy: { createdAt: "desc" },
    });
    const match = last?.invoiceNumber?.match(/^INV-(\d+)$/);
    const nextNum = (match ? parseInt(match[1], 10) : 0) + 1 + attempt;
    const invoiceNumber = `INV-${String(nextNum).padStart(5, "0")}`;

    try {
      invoice = await prisma.invoice.create({
        data: {
          orgId,
          customerId,
          siteId: siteId || null,
          workOrderId: workOrderId || null,
          quoteId: quoteId || null,
          invoiceNumber,
          title,
          description: description || null,
          status: InvoiceStatus.DRAFT,
          taxRate: taxRate ? parseFloat(taxRate) : 0,
          dueDate: dueDate ? new Date(dueDate) : null,
          notes: notes || null,
          terms: terms || null,
          createdByUserId: userId,
        },
      });
      break;
    } catch (err: any) {
      if (err?.code !== "P2002" || attempt === 4) throw err;
    }
  }

  return NextResponse.json({ data: invoice }, { status: 201 });
}
