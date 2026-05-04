import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@prisma/client";
import { sendInvoiceEmail } from "@/lib/email/email-service";
import { generateInvoicePdf } from "@/lib/pdf/pdf-generator";

export const runtime = "nodejs";

/**
 * POST /api/invoices/[id]/email
 * Send invoice to customer via email with PDF attachment.
 * Accepts { email: "one" } or { emails: ["one","two"] }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id: invoiceId } = await context.params;
    const body = await request.json();

    // Accept either { email: "one" } or { emails: ["one","two"] }
    let recipients: string[] = [];
    if (Array.isArray(body.emails)) {
      recipients = body.emails.map((e: string) => e.trim()).filter(Boolean);
    } else if (typeof body.email === "string" && body.email.trim()) {
      recipients = body.email.split(",").map((e: string) => e.trim()).filter(Boolean);
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "At least one email address is required" }, { status: 400 });
    }

    // Validate all emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = recipients.filter((e) => !emailRegex.test(e));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid email address(es): ${invalid.join(", ")}` },
        { status: 400 }
      );
    }

    // Get invoice with all related data
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, orgId: auth.orgId },
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
          select: { name: true, address: true },
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

    const org = await prisma.org.findUnique({
      where: { id: auth.orgId },
      select: { name: true },
    });
    const orgName = org?.name || "ServiceOpsIQ";

    // Generate the same PDF used by the download route
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generateInvoicePdf({
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
          ? { name: invoice.site.name, address: invoice.site.address }
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
    }

    // Send to all recipients
    const emailResult = await sendInvoiceEmail({
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.name,
      customerEmail: recipients,
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

    // Update invoice status (DRAFT -> SENT)
    let updatedStatus = invoice.status;
    if (invoice.status === InvoiceStatus.DRAFT) {
      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.SENT },
        select: { status: true },
      });
      updatedStatus = updated.status;
    }

    const recipientList = recipients.join(", ");
    return NextResponse.json({
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: updatedStatus,
        message: `Invoice ${invoice.invoiceNumber} sent to ${recipientList}`,
        recipients,
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
