import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { generateWorkOrderReportPdf } from "@/lib/pdf/pdf-generator";
import { sendWorkOrderEmail } from "@/lib/email/email-service";

export const runtime = "nodejs";

/**
 * POST /api/work-orders/[id]/email
 * Send work order email to customer with PDF attachment.
 * Accepts { emails: ["a@b"] } or sends to customer.primaryEmail if no body.
 */
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
    // Parse body (optional — backwards compat for no-body requests)
    let bodyEmails: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body.emails)) {
        bodyEmails = body.emails.map((e: string) => e.trim()).filter(Boolean);
      } else if (typeof body.email === "string" && body.email.trim()) {
        bodyEmails = body.email.split(",").map((e: string) => e.trim()).filter(Boolean);
      }
    } catch {
      // No body or invalid JSON — will fall back to customer email
    }

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
                  select: { name: true },
                },
              },
              orderBy: { sequenceNumber: "asc" },
            },
          },
          orderBy: { packageType: "asc" },
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
          select: { accumulatedSeconds: true },
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    // Determine recipients
    const recipients = bodyEmails.length > 0
      ? bodyEmails
      : workOrder.customer?.primaryEmail
        ? [workOrder.customer.primaryEmail]
        : [];

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No email recipients. Customer has no email address." },
        { status: 400 }
      );
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

    // Generate PDF using the same react-pdf generator as the download route
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generateWorkOrderReportPdf({
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
          ? { name: workOrder.site.name, address: workOrder.site.address }
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
            assignedTo: task.assignedTo ? { name: task.assignedTo.name } : null,
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
    } catch (pdfError) {
      console.error("Failed to generate PDF:", pdfError);
    }

    // Get primary tech name
    const techName = workOrder.visits[0]?.assignedTech?.name || null;

    // Send email to all recipients
    const result = await sendWorkOrderEmail({
      workOrderNumber: woNumber,
      customerName: workOrder.customer?.name || "Customer",
      customerEmail: recipients,
      title: workOrder.title,
      description: workOrder.description,
      status: workOrder.status,
      orgName,
      siteName: workOrder.site?.name || null,
      technicianName: techName,
      pdfBuffer: pdfBuffer ? Buffer.from(pdfBuffer) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    const recipientList = recipients.join(", ");
    return NextResponse.json({
      data: {
        messageId: result.messageId,
        sentTo: recipientList,
      },
      message: `Work order emailed to ${recipientList}`,
    });
  } catch (error) {
    console.error("Error sending work order email:", error);
    return NextResponse.json(
      { error: "Failed to send work order email" },
      { status: 500 }
    );
  }
}
