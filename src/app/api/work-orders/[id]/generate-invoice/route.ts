import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { InvoiceStatus, InvoiceLineItemType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/work-orders/:id/generate-invoice
 * Generate an invoice from a completed work order with labor and materials
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { auth } = authResult;

  // Fetch work order with all relevant data
  const workOrder = await prisma.workOrder.findFirst({
    where: {
      id: workOrderId,
      orgId: auth.orgId,
    },
    include: {
      customer: true,
      site: true,
      packages: {
        include: {
          tasks: {
            include: {
              timeEntries: {
                include: {
                  user: true,
                },
              },
              materialUsages: true,
            },
          },
        },
      },
    },
  });

  if (!workOrder) {
    return jsonError("Work order not found.", 404);
  }

  // Check if invoice already exists for this work order
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      workOrderId,
      orgId: auth.orgId,
    },
  });

  if (existingInvoice) {
    return jsonError("Invoice already exists for this work order.", 400);
  }

  // Generate invoice number
  const lastInvoice = await prisma.invoice.findFirst({
    where: { orgId: auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  const nextNumber = lastInvoice 
    ? parseInt(lastInvoice.invoiceNumber.replace(/\D/g, "")) + 1 
    : 1;
  const invoiceNumber = `INV-${String(nextNumber).padStart(6, "0")}`;

  // Fetch labor rate for this org (TECH role)
  const laborRateConfig = await prisma.laborRateConfig.findFirst({
    where: {
      orgId: auth.orgId,
      role: "TECH",
      isActive: true,
    },
  });

  const LABOR_RATE = laborRateConfig 
    ? parseFloat(laborRateConfig.hourlyRate.toString())
    : 85; // Default fallback rate

  // Calculate labor line items
  const laborLineItems: Array<{
    itemType: InvoiceLineItemType;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taskId: string | null;
    sortOrder: number;
  }> = [];

  const allTasks = workOrder.packages.flatMap(pkg => pkg.tasks);
  let laborSortOrder = 0;

  for (const task of allTasks) {
    const totalSeconds = task.timeEntries.reduce(
      (sum, entry) => sum + (entry.accumulatedSeconds || 0),
      0
    );

    if (totalSeconds > 0) {
      const hours = totalSeconds / 3600;
      const techNames = [...new Set(task.timeEntries.map(e => e.user?.name || "Technician"))].join(", ");
      
      laborLineItems.push({
        itemType: InvoiceLineItemType.LABOR,
        description: `Labor: ${task.title} (${techNames})`,
        quantity: parseFloat(hours.toFixed(2)),
        unitPrice: LABOR_RATE,
        totalPrice: parseFloat((hours * LABOR_RATE).toFixed(2)),
        taskId: task.id,
        sortOrder: laborSortOrder++,
      });
    }
  }

  // Calculate material line items
  const materialLineItems: Array<{
    itemType: InvoiceLineItemType;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    materialUsageId: string | null;
    taskId: string | null;
    sortOrder: number;
  }> = [];

  let materialSortOrder = laborLineItems.length;

  for (const task of allTasks) {
    for (const material of task.materialUsages) {
      if (material.totalCost && material.totalCost > 0) {
        const unitCost = material.unitCost || (material.totalCost / material.quantity);
        
        materialLineItems.push({
          itemType: InvoiceLineItemType.MATERIAL,
          description: `Material: ${material.name}${material.partNumber ? ` (${material.partNumber})` : ""}`,
          quantity: parseFloat(material.quantity.toString()),
          unitPrice: parseFloat(unitCost.toFixed(2)),
          totalPrice: parseFloat(material.totalCost.toFixed(2)),
          materialUsageId: material.id,
          taskId: task.id,
          sortOrder: materialSortOrder++,
        });
      }
    }
  }

  // Calculate totals
  const subtotal = [...laborLineItems, ...materialLineItems].reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  const taxRate = 0; // Default no tax, can be configured
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  // Create invoice with line items
  const invoice = await prisma.invoice.create({
    data: {
      orgId: auth.orgId,
      customerId: workOrder.customerId,
      siteId: workOrder.siteId,
      workOrderId: workOrder.id,
      invoiceNumber,
      status: InvoiceStatus.DRAFT,
      title: `Services for ${workOrder.title}`,
      description: workOrder.description,
      subtotal: new Decimal(subtotal.toFixed(2)),
      tax: new Decimal(tax.toFixed(2)),
      taxRate: new Decimal(taxRate.toFixed(2)),
      total: new Decimal(total.toFixed(2)),
      dueDate: null, // Can be set later
      notes: null,
      terms: "Payment due within 30 days",
      createdByUserId: auth.userId,
      lineItems: {
        create: [...laborLineItems, ...materialLineItems].map(item => ({
          orgId: auth.orgId,
          itemType: item.itemType,
          description: item.description,
          quantity: new Decimal(item.quantity.toFixed(2)),
          unitPrice: new Decimal(item.unitPrice.toFixed(2)),
          totalPrice: new Decimal(item.totalPrice.toFixed(2)),
          taskId: item.taskId || null,
          materialUsageId: ("materialUsageId" in item ? item.materialUsageId : null) || null,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: {
      customer: true,
      site: true,
      workOrder: true,
      lineItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return NextResponse.json({ data: invoice }, { status: 201 });
}
