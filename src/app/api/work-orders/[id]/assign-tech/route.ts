import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// POST /api/work-orders/[id]/assign-tech - Assign a technician to a work order
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
    const { techId, assignTasks } = body;

    if (!techId) {
      return NextResponse.json({ error: "techId is required" }, { status: 400 });
    }

    // Verify WO exists and belongs to org
    const workOrder = await prisma.workOrder.findFirst({
      where: { id, orgId },
      select: { id: true, status: true, workOrderNumber: true },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    if (workOrder.status === "COMPLETED" || workOrder.status === "CANCELED") {
      return NextResponse.json(
        { error: `Cannot assign techs to a ${workOrder.status.toLowerCase()} work order` },
        { status: 400 }
      );
    }

    // Verify tech exists, belongs to org, and has TECH role
    const tech = await prisma.user.findFirst({
      where: { id: techId, orgId, role: "TECH" },
      select: { id: true, name: true, email: true },
    });

    if (!tech) {
      return NextResponse.json(
        { error: "Technician not found or does not have TECH role" },
        { status: 404 }
      );
    }

    // Check if a visit already exists for this tech on this WO
    const existingVisit = await prisma.visit.findFirst({
      where: { workOrderId: id, assignedTechId: techId, orgId },
    });

    let visit = existingVisit;

    if (!visit) {
      // Generate a visit number
      const visitCount = await prisma.visit.count({
        where: { workOrderId: id, orgId },
      });

      visit = await prisma.visit.create({
        data: {
          orgId,
          workOrderId: id,
          assignedTechId: techId,
          status: "PLANNED",
          visitNumber: `${workOrder.workOrderNumber || id.slice(0, 8)}-V${visitCount + 1}`,
        },
      });
    }

    // Optionally assign unassigned tasks to this tech
    let tasksAssigned = 0;
    if (assignTasks) {
      const result = await prisma.taskInstance.updateMany({
        where: {
          workOrderId: id,
          orgId,
          assignedToId: null,
        },
        data: {
          assignedToId: techId,
        },
      });
      tasksAssigned = result.count;
    }

    return NextResponse.json({
      data: {
        visitId: visit.id,
        techId: tech.id,
        techName: tech.name,
        tasksAssigned,
      },
      message: `${tech.name || tech.email} assigned to work order${tasksAssigned > 0 ? ` (${tasksAssigned} tasks assigned)` : ""}`,
    });
  } catch (error) {
    console.error("Error assigning tech:", error);
    return NextResponse.json(
      { error: "Failed to assign technician" },
      { status: 500 }
    );
  }
}
