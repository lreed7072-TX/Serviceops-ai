import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";
import { sendQuoteEmail } from "@/lib/email/email-service";
import { generateQuotePdf } from "@/lib/pdf/pdf-generator";

export const runtime = "nodejs";

/**
 * POST /api/quotes/[id]/email
 * Send quote to customer via email with PDF attachment.
 * Accepts { email: "single@addr" } or { emails: ["a@b", "c@d"] }
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

    const { id: quoteId } = await context.params;
    const body = await request.json();

    // Accept either { email: "one" } or { emails: ["one","two"] }
    let recipients: string[] = [];
    if (Array.isArray(body.emails)) {
      recipients = body.emails.map((e: string) => e.trim()).filter(Boolean);
    } else if (typeof body.email === "string" && body.email.trim()) {
      // Support comma-separated in single field too
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

    // Get quote with all related data
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, orgId: auth.orgId },
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
        lineItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const org = await prisma.org.findUnique({
      where: { id: auth.orgId },
      select: { name: true },
    });
    const orgName = org?.name || "ServiceOpsIQ";

    // Generate the same PDF used by the download route
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generateQuotePdf({
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        description: quote.description,
        status: quote.status,
        subtotal: Number(quote.subtotal),
        tax: Number(quote.tax),
        taxRate: Number(quote.taxRate),
        total: Number(quote.total),
        validUntil: quote.validUntil?.toISOString() || null,
        notes: quote.notes,
        terms: quote.terms,
        sentAt: quote.sentAt?.toISOString() || null,
        approvedAt: quote.approvedAt?.toISOString() || null,
        approvedByName: quote.approvedByName,
        rejectedAt: quote.rejectedAt?.toISOString() || null,
        createdAt: quote.createdAt.toISOString(),
        customer: {
          name: quote.customer.name,
          primaryEmail: quote.customer.primaryEmail,
          primaryPhone: quote.customer.primaryPhone,
          billingAddress: quote.customer.billingAddress,
        },
        site: quote.site
          ? { name: quote.site.name, address: quote.site.address }
          : null,
        lineItems: quote.lineItems.map((item) => ({
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
    const emailResult = await sendQuoteEmail({
      quoteNumber: quote.quoteNumber,
      customerName: quote.customer.name,
      customerEmail: recipients,
      total: Number(quote.total),
      validUntil: quote.validUntil?.toISOString() || null,
      title: quote.title,
      description: quote.description,
      orgName,
      pdfBuffer,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || "Failed to send email" },
        { status: 500 }
      );
    }

    // Mark as SENT if currently DRAFT
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: quote.status === QuoteStatus.DRAFT ? QuoteStatus.SENT : quote.status,
        sentAt: new Date(),
      },
    });

    const recipientList = recipients.join(", ");
    return NextResponse.json({
      data: {
        message: `Quote ${quote.quoteNumber} sent to ${recipientList}`,
        recipients,
        pdfIncluded: !!pdfBuffer,
      },
    });
  } catch (error) {
    console.error("Failed to email quote:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
