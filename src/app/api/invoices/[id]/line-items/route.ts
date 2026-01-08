import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role, InvoiceLineItemType } from "@prisma/client";

// POST /api/invoices/[id]/line-items
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId, status: "DRAFT" },
  });

  if (!invoice) {
    return NextResponse.json(
      { error: "Invoice not found or not editable" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const { itemType, description, quantity, unitPrice, taskId, materialUsageId } = body;

  if (!description || quantity == null || unitPrice == null) {
    return NextResponse.json(
      { error: "Description, quantity, and unitPrice required" },
      { status: 400 }
    );
  }

  const qty = parseFloat(quantity);
  const price = parseFloat(unitPrice);
  const totalPrice = qty * price;

  const lineItem = await prisma.invoiceLineItem.create({
    data: {
      orgId,
      invoiceId,
      itemType: itemType || InvoiceLineItemType.OTHER,
      description,
      quantity: qty,
      unitPrice: price,
      totalPrice,
      taskId: taskId || null,
      materialUsageId: materialUsageId || null,
    },
  });

  // Recalculate totals
  const items = await prisma.invoiceLineItem.findMany({
    where: { invoiceId },
  });

  const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const taxRate = Number(invoice.taxRate);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { subtotal, tax, total },
  });

  return NextResponse.json({ data: lineItem }, { status: 201 });
}
