import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { InvoiceStatus } from "@prisma/client";
import { parseJson } from "@/lib/api-server";
import { syncInvoiceToQbo, getActiveConnection } from "@/lib/qbo/qbo-sync";

// GET /api/invoices/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId },
    include: {
      customer: true,
      site: true,
      workOrder: { select: { id: true, workOrderNumber: true, title: true } },
      quote: { select: { id: true, quoteNumber: true } },
      createdBy: { select: { name: true, email: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ data: invoice });
}

// PATCH /api/invoices/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  const body = await parseJson(req) as any;
  
  // Check invoice exists
  const existing = await prisma.invoice.findFirst({
    where: { id, orgId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updateData: any = {};

  // Update status
  if (body?.status && Object.values(InvoiceStatus).includes(body.status)) {
    updateData.status = body.status;
    
    // Set paidAt when status becomes PAID
    if (body.status === InvoiceStatus.PAID && !existing.paidAt) {
      updateData.paidAt = new Date();
    }
    
    // Clear paidAt if status changes from PAID to something else
    if (body.status !== InvoiceStatus.PAID && existing.paidAt) {
      updateData.paidAt = null;
    }
  }

  // Update other fields if provided (only for DRAFT invoices)
  if (existing.status === InvoiceStatus.DRAFT) {
    if (body?.title !== undefined) {
      updateData.title = body.title;
    }
    if (body?.description !== undefined) {
      updateData.description = body.description || null;
    }
    if (body?.taxRate !== undefined) {
      const newTaxRate = parseFloat(body.taxRate) || 0;
      updateData.taxRate = newTaxRate;
      // Recalculate tax and total
      const currentSubtotal = Number(existing.subtotal);
      updateData.tax = currentSubtotal * (newTaxRate / 100);
      updateData.total = currentSubtotal + updateData.tax;
    }
  }

  if (body?.dueDate !== undefined) {
    updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (body?.notes !== undefined) {
    updateData.notes = body.notes;
  }
  if (body?.terms !== undefined) {
    updateData.terms = body.terms;
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: updateData,
    include: {
      customer: true,
      site: true,
      workOrder: { select: { id: true, workOrderNumber: true, title: true } },
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  // When status changes to SENT, trigger async QBO sync if connected
  if (body?.status === InvoiceStatus.SENT && existing.status !== InvoiceStatus.SENT) {
    getActiveConnection(orgId).then((conn) => {
      if (conn) {
        syncInvoiceToQbo(orgId, id).catch((err) => {
          console.error("QBO invoice sync failed:", err);
        });
      }
    });
  }

  return NextResponse.json({ data: invoice });
}
