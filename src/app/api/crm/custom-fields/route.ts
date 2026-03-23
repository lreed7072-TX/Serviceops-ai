import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { CustomFieldEntityType, CustomFieldType, Role } from "@prisma/client";

export const runtime = "nodejs";

type CustomFieldPayload = {
  entityType?: string;
  industryId?: string | null;
  fieldName?: string;
  fieldType?: string;
  displayOrder?: number;
  isActive?: boolean;
};

const VALID_ENTITY_TYPES = Object.values(CustomFieldEntityType);
const VALID_FIELD_TYPES = Object.values(CustomFieldType);

/**
 * GET /api/crm/custom-fields
 * List custom field definitions for the org, optionally filtered by entityType and industryId.
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as CustomFieldEntityType | null;
    const industryId = searchParams.get("industryId");

    const where: any = { orgId: auth.orgId };
    if (entityType && VALID_ENTITY_TYPES.includes(entityType)) {
      where.entityType = entityType;
    }
    if (industryId) {
      where.industryId = industryId;
    }

    const definitions = await prisma.customFieldDefinition.findMany({
      where,
      include: { industry: { select: { id: true, name: true } } },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ data: definitions });
  } catch (err) {
    console.error("GET /api/crm/custom-fields failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

/**
 * POST /api/crm/custom-fields
 * Create a new custom field definition. ADMIN only.
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const roleError = requireRole(auth, [Role.ADMIN]);
  if (roleError) return roleError;

  try {
    const body = await parseJson<CustomFieldPayload>(request);
    if (!body?.fieldName?.trim()) {
      return jsonError("fieldName is required.");
    }
    if (!body.entityType || !VALID_ENTITY_TYPES.includes(body.entityType as CustomFieldEntityType)) {
      return jsonError(`entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}.`);
    }
    if (body.fieldType && !VALID_FIELD_TYPES.includes(body.fieldType as CustomFieldType)) {
      return jsonError(`fieldType must be one of: ${VALID_FIELD_TYPES.join(", ")}.`);
    }

    const definition = await prisma.customFieldDefinition.create({
      data: {
        orgId: auth.orgId,
        entityType: body.entityType as CustomFieldEntityType,
        industryId: body.industryId ?? null,
        fieldName: body.fieldName.trim(),
        fieldType: (body.fieldType as CustomFieldType) ?? CustomFieldType.TEXT,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ data: definition }, { status: 201 });
  } catch (err) {
    console.error("POST /api/crm/custom-fields failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
