import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@prisma/client";
import { sendInvoiceEmail } from "@/lib/email/email-service";
import { generateInvoicePDF } from "@/lib/pdf/invoice-pdf";

/**
 * POST /api/invoices/[id]/email
 * Send invoice to customer via email with PDF attachment
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // Check permissions
    if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const resolvedParams = await context.params;
    const invoiceId = resolvedParams.id;

    const body = await request.json();
    const { email, includePdf = true } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    // Get invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        orgId: auth.orgId
      },
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
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get organization name
    const org = await prisma.org.findUnique({
      where: { id: auth.orgId },
      select: { name: true },
    });

    const orgName = org?.name || "ServiceOpsIQ";

    // Generate PDF if requested
    let pdfBuffer: Buffer | undefined;
    if (includePdf) {
      try {
        pdfBuffer = await generateInvoicePDF({
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
          orgName,
        });
      } catch (pdfError) {
        console.error("Failed to generate PDF:", pdfError);
        // Continue without PDF attachment
      }
    }

    // Send email
    const emailResult = await sendInvoiceEmail({
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.name,
      customerEmail: email,
      total: Number(invoice.total),
      dueDate: invoice.dueDate?.toISOString() || null,
      title: invoice.title,
      description: invoice.description,
      orgName,
      pdfBuffer,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || "Failed to send email" },
        { status: 500 }
      );
    }

    // Update invoice status (DRAFT -> SENT) and sentAt timestamp if applicable
    const updateData: any = {};
    if (invoice.status === InvoiceStatus.DRAFT) {
      updateData.status = InvoiceStatus.SENT;
    }

    let updatedStatus = invoice.status;
    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: updateData,
        select: { status: true },
      });
      updatedStatus = updated.status;
    }

    return NextResponse.json({
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: updatedStatus,
        message: `Invoice ${invoice.invoiceNumber} sent to ${email}`,
        email: email,
        pdfIncluded: !!pdfBuffer,
      },
    });
  } catch (error) {
    console.error("Failed to email invoice:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
