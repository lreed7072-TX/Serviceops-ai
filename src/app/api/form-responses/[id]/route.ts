import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/form-responses/[id] — Get single form response
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    const response = await prisma.formResponse.findUnique({
      where: { id, orgId: auth.orgId },
      include: {
        reportTemplate: {
          select: { id: true, name: true, definition: true, schemaVersion: true },
        },
        workOrder: {
          select: { id: true, workOrderNumber: true, title: true },
        },
        site: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, serialNumber: true } },
        filledBy: { select: { id: true, name: true } },
      },
    });

    if (!response) {
      return jsonError("Form response not found", 404);
    }

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error("Failed to fetch form response:", error);
    return jsonError("Failed to fetch form response", 500);
  }
}

// PATCH /api/form-responses/[id] — Auto-save draft data
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    const body = await parseJson<{ data: Record<string, unknown> }>(request);
    if (!body?.data || typeof body.data !== "object") {
      return jsonError("data object is required", 400);
    }

    // Fetch existing response
    const existing = await prisma.formResponse.findUnique({
      where: { id, orgId: auth.orgId },
      select: { id: true, status: true, data: true },
    });

    if (!existing) {
      return jsonError("Form response not found", 404);
    }

    if (existing.status !== "DRAFT") {
      return jsonError("Only draft responses can be edited", 400);
    }

    // Merge incoming data with existing (spread, not replace)
    const existingData =
      existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
        ? (existing.data as Record<string, unknown>)
        : {};
    const mergedData = { ...existingData, ...body.data };

    const updated = await prisma.formResponse.update({
      where: { id },
      data: { data: mergedData as Prisma.InputJsonValue },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Failed to update form response:", error);
    return jsonError("Failed to update form response", 500);
  }
}

// DELETE /api/form-responses/[id] — Delete response
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    // Verify exists in org
    const existing = await prisma.formResponse.findUnique({
      where: { id, orgId: auth.orgId },
      select: { id: true },
    });

    if (!existing) {
      return jsonError("Form response not found", 404);
    }

    await prisma.formResponse.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("Failed to delete form response:", error);
    return jsonError("Failed to delete form response", 500);
  }
}
