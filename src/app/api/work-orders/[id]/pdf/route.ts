import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { generateWorkOrderReportPdf } from "@/lib/pdf/pdf-generator";

// GET /api/work-orders/[id]/pdf
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  // Fetch work order with all related data
  const workOrder = await prisma.workOrder.findFirst({
    where: { id, orgId },
    include: {
      customer: {
        select: {
          name: true,
          primaryEmail: true,
          primaryPhone: true,
        },
      },
      site: {
        select: {
          name: true,
          address: true,
        },
      },
      asset: {
        select: {
          name: true,
          serialNumber: true,
          assetTag: true,
        },
      },
      packages: {
        include: {
          tasks: {
            include: {
              assignedTo: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              sequenceNumber: "asc",
            },
          },
        },
        orderBy: {
          packageType: "asc",
        },
      },
      timeEntries: {
        select: {
          accumulatedSeconds: true,
        },
      },
    },
  });

  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  // Fetch org name
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  // Calculate summary metrics
  const totalTasks = workOrder.packages.reduce((sum, pkg) => sum + pkg.tasks.length, 0);
  const completedTasks = workOrder.packages.reduce(
    (sum, pkg) => sum + pkg.tasks.filter((t) => t.status === "DONE").length,
    0
  );
  const totalLaborSeconds = workOrder.timeEntries.reduce(
    (sum, entry) => sum + (entry.accumulatedSeconds || 0),
    0
  );
  const totalLaborHours = Math.round((totalLaborSeconds / 3600) * 10) / 10;

  try {
    // Generate PDF
    const pdfBuffer = await generateWorkOrderReportPdf({
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      description: workOrder.description,
      status: workOrder.status,
      executionMode: workOrder.executionMode,
      orderType: workOrder.orderType,
      priority: null,
      scheduledStart: null,
      scheduledEnd: null,
      createdAt: workOrder.createdAt.toISOString(),
      customer: workOrder.customer
        ? {
            name: workOrder.customer.name,
            primaryEmail: workOrder.customer.primaryEmail,
            primaryPhone: workOrder.customer.primaryPhone,
          }
        : null,
      site: workOrder.site
        ? {
            name: workOrder.site.name,
            address: workOrder.site.address,
          }
        : null,
      asset: workOrder.asset
        ? {
            name: workOrder.asset.name,
            serialNumber: workOrder.asset.serialNumber,
            assetTag: workOrder.asset.assetTag,
          }
        : null,
      packages: workOrder.packages.map((pkg) => ({
        id: pkg.id,
        packageType: pkg.packageType,
        tasks: pkg.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          sequenceNumber: task.sequenceNumber,
          isCritical: task.isCritical,
          assignedTo: task.assignedTo
            ? { name: task.assignedTo.name }
            : null,
        })),
      })),
      summary: {
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        totalLaborHours,
        totalMaterialCost: 0,
      },
      orgName: org?.name || "Company",
    });

    const fileName = workOrder.workOrderNumber || `WO-${id.slice(0, 8).toUpperCase()}`;

    // Return PDF as downloadable file
    return new NextResponse(new Uint8Array(pdfBuffer) as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
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
