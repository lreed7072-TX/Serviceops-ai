import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { generateInvoicePdf } from "@/lib/pdf/pdf-generator";

// GET /api/invoices/[id]/pdf
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  // Fetch invoice with all related data
  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId },
    include: {
      customer: {
        select: {
          name: true,
          primaryEmail: true,
          primaryPhone: true,
          billingAddress: true,
        },
      },
      site: {
        select: {
          name: true,
          address: true,
        },
      },
      workOrder: {
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
        },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Fetch org name
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  try {
    // Generate PDF
    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      description: invoice.description,
      status: invoice.status,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      taxRate: Number(invoice.taxRate),
      total: Number(invoice.total),
      dueDate: invoice.dueDate?.toISOString() || null,
      paidAt: invoice.paidAt?.toISOString() || null,
      notes: invoice.notes,
      terms: invoice.terms,
      createdAt: invoice.createdAt.toISOString(),
      customer: {
        name: invoice.customer.name,
        primaryEmail: invoice.customer.primaryEmail,
        primaryPhone: invoice.customer.primaryPhone,
        billingAddress: invoice.customer.billingAddress,
      },
      site: invoice.site
        ? {
            name: invoice.site.name,
            address: invoice.site.address,
          }
        : null,
      workOrder: invoice.workOrder
        ? {
            workOrderNumber: invoice.workOrder.workOrderNumber,
            title: invoice.workOrder.title,
          }
        : null,
      lineItems: invoice.lineItems.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      orgName: org?.name || "Company",
    });

    // Return PDF as downloadable file
    return new NextResponse(new Uint8Array(pdfBuffer) as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="INV-${invoice.invoiceNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
