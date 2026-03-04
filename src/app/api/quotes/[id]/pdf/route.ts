import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { generateQuotePdf } from "@/lib/pdf/pdf-generator";

// GET /api/quotes/[id]/pdf
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  // Fetch quote with all related data
  const quote = await prisma.quote.findFirst({
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
      lineItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Fetch org name
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  try {
    // Generate PDF
    const pdfBuffer = await generateQuotePdf({
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
        ? {
            name: quote.site.name,
            address: quote.site.address,
          }
        : null,
      lineItems: quote.lineItems.map((item) => ({
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
        "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
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
