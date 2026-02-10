import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { generateServiceReportPDF } from "@/lib/pdf/service-report";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/work-orders/:id/service-report
 * Generate and download a comprehensive service report PDF
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id: workOrderId } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id: workOrderId, orgId: auth.orgId },
    include: {
      customer: true,
      site: true,
      asset: true,
      packages: {
        include: {
          tasks: {
            include: {
              assignedTo: { select: { id: true, name: true, email: true } },
              evidence: { orderBy: { createdAt: "asc" } },
              measurements: {
                include: { measurementDefinition: true },
                orderBy: { capturedAt: "asc" },
              },
              materialUsages: {
                include: { material: true },
                orderBy: { createdAt: "asc" },
              },
              timeEntries: {
                include: { user: { select: { name: true, email: true } } },
                orderBy: { startedAt: "asc" },
              },
              findings: {
                include: { createdByUser: { select: { name: true, email: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { sequenceNumber: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      signatures: { orderBy: { signedAt: "asc" } },
      siteCheckIns: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { checkInAt: "asc" },
      },
    },
  });

  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const org = await prisma.org.findUnique({
    where: { id: auth.orgId },
    select: { name: true, contactPhone: true, contactEmail: true, address: true },
  });

  try {
    const pdfBuffer = await generateServiceReportPDF(workOrder, org);
    const fileName = `ServiceReport-${workOrder.workOrderNumber || workOrderId.slice(0, 8).toUpperCase()}`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error generating service report PDF:", error);
    return NextResponse.json({ error: "Failed to generate service report" }, { status: 500 });
  }
}
