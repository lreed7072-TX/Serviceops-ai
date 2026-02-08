import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { generateWorkOrderPDF } from "@/lib/pdf/work-order-pdf";
import { sendWorkOrderEmail } from "@/lib/email/email-service";

// POST /api/work-orders/[id]/email - Send work order email to customer
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;
  const { orgId } = auth;

  try {
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
        visits: {
          where: { assignedTechId: { not: null } },
          include: {
            assignedTech: {
              select: { name: true },
            },
          },
          take: 1,
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

    if (!workOrder.customer?.primaryEmail) {
      return NextResponse.json(
        { error: "Customer does not have an email address. Please add one before sending." },
        { status: 400 }
      );
    }

    // Fetch org name
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const orgName = org?.name || "Company";

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

    const woNumber = workOrder.workOrderNumber || `WO-${id.slice(0, 8).toUpperCase()}`;

    // Generate PDF
    const pdfBuffer = await generateWorkOrderPDF({
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
      orgName,
    });

    // Get primary tech name from visits
    const techName = workOrder.visits[0]?.assignedTech?.name || null;

    // Send email
    const result = await sendWorkOrderEmail({
      workOrderNumber: woNumber,
      customerName: workOrder.customer.name,
      customerEmail: workOrder.customer.primaryEmail,
      title: workOrder.title,
      description: workOrder.description,
      status: workOrder.status,
      orgName,
      siteName: workOrder.site?.name || null,
      technicianName: techName,
      pdfBuffer: Buffer.from(pdfBuffer),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        messageId: result.messageId,
        sentTo: workOrder.customer.primaryEmail,
      },
      message: `Work order emailed to ${workOrder.customer.primaryEmail}`,
    });
  } catch (error) {
    console.error("Error sending work order email:", error);
    return NextResponse.json(
      { error: "Failed to send work order email" },
      { status: 500 }
    );
  }
}
