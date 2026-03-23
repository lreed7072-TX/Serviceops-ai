import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { CustomFieldEntityType, CustomFieldType, Role } from "@prisma/client";

export const runtime = "nodejs";

type CustomFieldUpdatePayload = {
  fieldName?: string;
  fieldType?: string;
  entityType?: string;
  industryId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/crm/custom-fields/:id
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const definition = await prisma.customFieldDefinition.findFirst({
      where: { id, orgId: auth.orgId },
      include: { industry: { select: { id: true, name: true } } },
    });

    if (!definition) {
      return jsonError("Custom field definition not found.", 404);
    }

    return NextResponse.json({ data: definition });
  } catch (err) {
    console.error("GET /api/crm/custom-fields/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

/**
 * PUT /api/crm/custom-fields/:id
 * Update a custom field definition. ADMIN only.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  try {
    const body = await parseJson<CustomFieldUpdatePayload>(request);
    if (!body) {
      return jsonError("Invalid JSON body.");
    }

    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Custom field definition not found.", 404);
    }

    const VALID_FIELD_TYPES = Object.values(CustomFieldType);
    if (body.fieldType && !VALID_FIELD_TYPES.includes(body.fieldType as CustomFieldType)) {
      return jsonError(`fieldType must be one of: ${VALID_FIELD_TYPES.join(", ")}.`);
    }

    const definition = await prisma.customFieldDefinition.update({
      where: { id },
      data: {
        fieldName: body.fieldName?.trim() ?? existing.fieldName,
        fieldType: (body.fieldType as CustomFieldType) ?? existing.fieldType,
        industryId: body.industryId !== undefined ? body.industryId : existing.industryId,
        displayOrder: body.displayOrder ?? existing.displayOrder,
        isActive: body.isActive ?? existing.isActive,
      },
    });

    return NextResponse.json({ data: definition });
  } catch (err) {
    console.error("PUT /api/crm/custom-fields/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

/**
 * DELETE /api/crm/custom-fields/:id
 * Delete a custom field definition (cascades to values). ADMIN only.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  try {
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, orgId: auth.orgId },
    });

    if (!existing) {
      return jsonError("Custom field definition not found.", 404);
    }

    await prisma.customFieldDefinition.delete({ where: { id } });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error("DELETE /api/crm/custom-fields/[id] failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
