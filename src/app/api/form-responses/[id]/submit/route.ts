import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import {
  TemplateDefinition,
  FormResponseData,
  computeAllCalculatedFields,
  validateFormResponse,
} from "@/lib/forms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/form-responses/[id]/submit — Submit a draft response
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuthSessionFirst(request);
    if ("error" in authResult) return authResult.error;
    const { auth } = authResult;

    const { id } = await params;

    const body = await parseJson<{
      submissionLat?: number;
      submissionLng?: number;
    }>(request);

    // Fetch response + template
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
      },
    });

    if (!response) {
      return jsonError("Form response not found", 404);
    }

    if (response.status !== "DRAFT") {
      return jsonError("Only draft responses can be submitted", 400);
    }

    // Cast template definition and response data
    const definition = response.reportTemplate.definition as unknown as TemplateDefinition;
    const responseData = (response.data ?? {}) as unknown as FormResponseData;

    // Recompute calculated fields server-side
    const computedData = computeAllCalculatedFields(
      definition.sections,
      responseData
    );

    // Validate required fields
    const errors = validateFormResponse(definition, computedData);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    // Freeze templateSnapshot and submit
    const updated = await prisma.formResponse.update({
      where: { id },
      data: {
        data: computedData as unknown as Prisma.InputJsonValue,
        templateSnapshot: response.reportTemplate.definition as Prisma.InputJsonValue,
        status: "SUBMITTED",
        submittedAt: new Date(),
        submissionLat: body?.submissionLat ?? null,
        submissionLng: body?.submissionLng ?? null,
      },
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

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Failed to submit form response:", error);
    return jsonError("Failed to submit form response", 500);
  }
}
