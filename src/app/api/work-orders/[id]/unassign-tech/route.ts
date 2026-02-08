import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// POST /api/work-orders/[id]/unassign-tech - Remove a technician from a work order
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
    const body = await req.json();
    const { techId } = body;

    if (!techId) {
      return NextResponse.json({ error: "techId is required" }, { status: 400 });
    }

    // Verify WO exists and belongs to org
    const workOrder = await prisma.workOrder.findFirst({
      where: { id, orgId },
      select: { id: true, status: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    if (workOrder.status === "COMPLETED" || workOrder.status === "CANCELED") {
      return NextResponse.json(
        { error: `Cannot modify techs on a ${workOrder.status.toLowerCase()} work order` },
        { status: 400 }
      );
    }

    // Delete PLANNED visits for this tech that have no time entries
    const visits = await prisma.visit.findMany({
      where: {
        workOrderId: id,
        assignedTechId: techId,
        orgId,
        status: "PLANNED",
      },
      select: {
        id: true,
        _count: {
          select: {
            findings: true,
            measures: true,
            files: true,
            reports: true,
          },
        },
      },
    });

    // Check for time entries on these visits
    const visitIds = visits.map((v) => v.id);

    // Only delete visits that have no associated data
    let visitsRemoved = 0;
    for (const visit of visits) {
      const hasData =
        visit._count.findings > 0 ||
        visit._count.measures > 0 ||
        visit._count.files > 0 ||
        visit._count.reports > 0;

      if (!hasData) {
        await prisma.visit.delete({ where: { id: visit.id } });
        visitsRemoved++;
      }
    }

    // Unassign tasks from this tech
    const result = await prisma.taskInstance.updateMany({
      where: {
        workOrderId: id,
        orgId,
        assignedToId: techId,
      },
      data: {
        assignedToId: null,
      },
    });

    return NextResponse.json({
      data: {
        visitsRemoved,
        tasksUnassigned: result.count,
      },
      message: `Technician removed from work order`,
    });
  } catch (error) {
    console.error("Error unassigning tech:", error);
    return NextResponse.json(
      { error: "Failed to remove technician" },
      { status: 500 }
    );
  }
}
