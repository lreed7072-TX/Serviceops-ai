import { NextRequest, NextResponse } from "next/server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/pm-schedules
 * List all PM schedules with filtering
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");
    const siteId = searchParams.get("siteId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      orgId: auth.orgId,
      workOrderContext: "PM",
    };
    if (assetId) where.assetId = assetId;
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;

    const schedules = await prisma.workflowDefinition.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            serialNumber: true,
          },
        },
        site: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true },
        },
        procedureTemplate: {
          select: { id: true, name: true },
        },
        lastGeneratedWorkOrder: {
          select: {
            id: true,
            workOrderNumber: true,
            status: true,
            dueDate: true,
          },
        },
      },
      orderBy: { nextScheduledDate: "asc" },
    });

    const schedulesWithDays = schedules.map((schedule) => {
      let daysUntilNext: number | null = null;
      if (schedule.nextScheduledDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextDate = new Date(schedule.nextScheduledDate);
        nextDate.setHours(0, 0, 0, 0);
        daysUntilNext = Math.ceil(
          (nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
      return { ...schedule, daysUntilNext };
    });

    return NextResponse.json({ data: schedulesWithDays });
  } catch (error) {
    console.error("Get PM schedules error:", error);
    return NextResponse.json(
      { error: "Failed to load PM schedules" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pm-schedules
 * Create a new PM schedule
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthSessionFirst(req);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const roleCheck = requireRole(auth, ["ADMIN", "DISPATCHER"]);
    if (roleCheck) return roleCheck;

    const body = await req.json();
    const {
      name,
      description,
      assetId,
      siteId,
      customerId,
      procedureTemplateId,
      frequencyType,
      frequencyValue,
      startDate,
      autoGenerateWorkOrders,
      workOrderTitle,
      estimatedHours,
      priority,
    } = body;

    if (!name || !assetId || !frequencyType || !frequencyValue) {
      return NextResponse.json(
        { error: "name, assetId, frequencyType, and frequencyValue are required" },
        { status: 400 }
      );
    }

    if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(frequencyType)) {
      return NextResponse.json(
        { error: "Invalid frequency type" },
        { status: 400 }
      );
    }

    const freqVal = parseInt(frequencyValue);
    if (freqVal < 1 || freqVal > 365) {
      return NextResponse.json(
        { error: "Frequency value must be between 1 and 365" },
        { status: 400 }
      );
    }

    // Verify asset exists and belongs to org
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, orgId: auth.orgId },
      select: { siteId: true, site: { select: { customerId: true } } },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const nextDate = calculateNextDate(start, frequencyType, freqVal);

    const schedule = await prisma.workflowDefinition.create({
      data: {
        orgId: auth.orgId,
        name,
        description: description || null,
        workOrderContext: "PM",
        status: "ACTIVE",
        assetId,
        siteId: siteId || asset.siteId,
        customerId: customerId || asset.site.customerId,
        procedureTemplateId: procedureTemplateId || null,
        frequencyType,
        frequencyValue: freqVal,
        nextScheduledDate: nextDate,
        autoGenerateWorkOrders: autoGenerateWorkOrders !== false,
        workOrderTitle: workOrderTitle || `PM: ${name}`,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        priority: priority || "MEDIUM",
        createdByUserId: auth.userId,
      },
      include: {
        asset: { select: { id: true, name: true, serialNumber: true } },
        site: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: schedule }, { status: 201 });
  } catch (error) {
    console.error("Create PM schedule error:", error);
    return NextResponse.json(
      { error: "Failed to create PM schedule" },
      { status: 500 }
    );
  }
}

function calculateNextDate(
  fromDate: Date,
  frequencyType: string,
  frequencyValue: number
): Date {
  const next = new Date(fromDate);
  switch (frequencyType) {
    case "DAILY":
      next.setDate(next.getDate() + frequencyValue);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + frequencyValue * 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + frequencyValue);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + frequencyValue);
      break;
  }
  return next;
}
