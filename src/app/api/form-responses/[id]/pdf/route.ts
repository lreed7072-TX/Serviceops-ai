import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { jsonError } from "@/lib/api-server";
import { generateFormReportPdf } from "@/lib/pdf/pdf-generator";
import type { FormReportData, FormReportFieldSection } from "@/lib/pdf/documents/FormReportDocument";
import type { TemplateDefinition } from "@/lib/forms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/form-responses/[id]/pdf — Generate PDF for a submitted form response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    // Role check: ADMIN or DISPATCHER only
    if (auth.role !== "ADMIN" && auth.role !== "DISPATCHER") {
      return jsonError("Insufficient permissions", 403);
    }

    const { id } = await params;

    // Fetch form response with related data
    const response = await prisma.formResponse.findUnique({
      where: { id, orgId: auth.orgId },
      include: {
        reportTemplate: {
          select: {
            id: true,
            name: true,
            definition: true,
            schemaVersion: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            title: true,
            customerId: true,
            customer: {
              select: { name: true },
            },
          },
        },
        site: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, serialNumber: true } },
        filledBy: { select: { id: true, name: true } },
      },
    });

    if (!response) {
      return jsonError("Form response not found", 404);
    }

    if (response.status === "DRAFT") {
      return jsonError("Cannot generate PDF for a draft response. Submit it first.", 400);
    }

    // Fetch org details
    const org = await prisma.org.findUnique({
      where: { id: auth.orgId },
      select: { name: true, logoUrl: true },
    });

    // Determine template definition: prefer frozen snapshot, fall back to current
    const templateDef = (
      response.templateSnapshot
        ? response.templateSnapshot
        : response.reportTemplate.definition
    ) as unknown as TemplateDefinition;

    // Build sections array for the PDF
    const sections: FormReportFieldSection[] = templateDef.sections.map((field) => ({
      blockId: field.blockId,
      type: field.type,
      title: field.title,
      props: field.props,
    }));

    // Build cover page settings
    const coverSettings = templateDef.settings?.coverPage;

    // Build the FormReportData object
    const reportData: FormReportData = {
      orgName: org?.name || "Company",
      orgLogoUrl: coverSettings?.showLogo ? (org?.logoUrl ?? undefined) : undefined,
      reportTitle: response.reportTemplate.name,
      subtitle: coverSettings?.subtitle || undefined,
      customerName:
        coverSettings?.showCustomerName && response.workOrder?.customer
          ? response.workOrder.customer.name
          : undefined,
      siteName: response.site?.name ?? undefined,
      assetName: response.asset?.name ?? undefined,
      assetSerial: response.asset?.serialNumber ?? undefined,
      workOrderNumber: response.workOrder?.workOrderNumber ?? undefined,
      techName: response.filledBy?.name || "Unknown",
      submittedAt: response.submittedAt?.toISOString() || response.createdAt.toISOString(),
      coverPageEnabled: coverSettings?.enabled ?? false,
      sections,
      data: (response.data ?? {}) as Record<string, unknown>,
    };

    // Generate PDF buffer
    const pdfBuffer = await generateFormReportPdf(reportData);

    // Update status to EXPORTED
    await prisma.formResponse.update({
      where: { id },
      data: { status: "EXPORTED" },
    });

    // Build filename
    const woNum = response.workOrder?.workOrderNumber || "";
    const templateName = response.reportTemplate.name
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
    const fileName = woNum
      ? `${woNum}-${templateName}.pdf`
      : `Report-${templateName}-${id.slice(0, 8)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer) as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error generating form report PDF:", error);
    return jsonError("Failed to generate PDF", 500);
  }
}
