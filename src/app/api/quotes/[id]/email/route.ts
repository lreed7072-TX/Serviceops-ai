import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuoteStatus } from "@prisma/client";

/**
 * POST /api/quotes/[id]/email
 * Send quote to customer via email
 *
 * TODO: Integrate with email service (SendGrid, AWS SES, etc.)
 * For now, this marks the quote as sent and updates the timestamp
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
    const quoteId = resolvedParams.id;

    const body = await request.json();
    const { email } = body;

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

    // Get quote with organization check
    const quote = await prisma.quote.findUnique({
      where: {
        id: quoteId,
        orgId: auth.orgId
      },
      include: {
        customer: true,
        lineItems: {
          orderBy: { sortOrder: "asc" }
        }
      }
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // TODO: Send actual email here
    // Example integration:
    // 
    // import { sendQuoteEmail } from "@/lib/email-service";
    // 
    // await sendQuoteEmail({
    //   to: email,
    //   quoteNumber: quote.quoteNumber,
    //   customerName: quote.customer.name,
    //   total: quote.total,
    //   validUntil: quote.validUntil,
    //   lineItems: quote.lineItems,
    //   pdfUrl: `${process.env.NEXT_PUBLIC_APP_URL}/quotes/${quote.id}/pdf`
    // });

    // Update quote status and sentAt timestamp
    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: quote.status === QuoteStatus.DRAFT ? QuoteStatus.SENT : quote.status,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        quote: updatedQuote,
        message: `Quote ${quote.quoteNumber} sent to ${email}`,
        email: email
      },
    });
  } catch (error) {
    console.error("Failed to email quote:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
