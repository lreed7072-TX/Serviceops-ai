import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";
import { generatePackingSlipPdf } from "@/lib/pdf/pdf-generator";

export const runtime = "nodejs";

/**
 * GET /api/work-orders/[id]/packing-slip
 * Generate a packing slip PDF (items + quantities, no prices)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const workOrder = await prisma.workOrder.findFirst({
    where: { id, orgId: auth.orgId },
    include: {
      customer: {
        select: {
          name: true,
          primaryPhone: true,
        },
      },
      site: {
        select: {
          name: true,
          address: true,
        },
      },
      packages: {
        include: {
          tasks: {
            include: {
              materialUsages: {
                include: {
                  material: {
                    select: { name: true, unit: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }

  const org = await prisma.org.findUnique({
    where: { id: auth.orgId },
    select: { name: true },
  });

  // Collect all material usages across all tasks as line items
  const lineItems: { description: string; quantity: number; unit: string | null }[] = [];
  for (const pkg of workOrder.packages) {
    for (const task of pkg.tasks) {
      for (const usage of task.materialUsages) {
        lineItems.push({
          description: usage.material?.name || usage.name || "Unknown item",
          quantity: Number(usage.quantity),
          unit: usage.material?.unit || null,
        });
      }
    }
  }

  // If no material usages, fall back to task titles as line items
  if (lineItems.length === 0) {
    for (const pkg of workOrder.packages) {
      for (const task of pkg.tasks) {
        lineItems.push({
          description: task.title,
          quantity: 1,
          unit: null,
        });
      }
    }
  }

  try {
    const woNumber = workOrder.workOrderNumber || `WO-${id.slice(0, 8).toUpperCase()}`;

    const pdfBuffer = await generatePackingSlipPdf({
      orderNumber: woNumber,
      orderType: workOrder.orderType,
      title: workOrder.title,
      createdAt: workOrder.createdAt.toISOString(),
      customer: {
        name: workOrder.customer?.name || "Customer",
        primaryPhone: workOrder.customer?.primaryPhone || null,
      },
      site: workOrder.site
        ? { name: workOrder.site.name, address: workOrder.site.address }
        : null,
      lineItems,
      notes: workOrder.description,
      orgName: org?.name || "Company",
    });

    return new NextResponse(new Uint8Array(pdfBuffer) as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${woNumber}-packing-slip.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error generating packing slip:", error);
    return NextResponse.json(
      { error: "Failed to generate packing slip" },
      { status: 500 }
    );
  }
}
