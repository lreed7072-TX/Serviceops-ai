import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { CustomFieldEntityType } from "@prisma/client";

export const runtime = "nodejs";

type ValuePayload = {
  fieldDefinitionId: string;
  entityType: string;
  entityId: string;
  value: string | null;
};

type BatchPayload = {
  entityType: string;
  entityId: string;
  fields: Array<{ fieldDefinitionId: string; value: string | null }>;
};

const VALID_ENTITY_TYPES = Object.values(CustomFieldEntityType);

/**
 * GET /api/crm/custom-field-values
 * Get custom field values for a specific entity.
 * Query params: entityType, entityId
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as CustomFieldEntityType | null;
    const entityId = searchParams.get("entityId");

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
      return jsonError(`entityType is required and must be one of: ${VALID_ENTITY_TYPES.join(", ")}.`);
    }
    if (!entityId) {
      return jsonError("entityId is required.");
    }

    const values = await prisma.customFieldValue.findMany({
      where: {
        orgId: auth.orgId,
        entityType,
        entityId,
      },
      include: {
        fieldDefinition: {
          select: { id: true, fieldName: true, fieldType: true, displayOrder: true, isActive: true },
        },
      },
      orderBy: { fieldDefinition: { displayOrder: "asc" } },
    });

    return NextResponse.json({ data: values });
  } catch (err) {
    console.error("GET /api/crm/custom-field-values failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

/**
 * POST /api/crm/custom-field-values
 * Batch upsert custom field values for an entity.
 * Body: { entityType, entityId, fields: [{ fieldDefinitionId, value }] }
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const body = await parseJson<BatchPayload>(request);

    if (!body?.entityType || !VALID_ENTITY_TYPES.includes(body.entityType as CustomFieldEntityType)) {
      return jsonError(`entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}.`);
    }
    if (!body.entityId) {
      return jsonError("entityId is required.");
    }
    if (!Array.isArray(body.fields) || body.fields.length === 0) {
      return jsonError("fields array is required and must not be empty.");
    }

    const entityType = body.entityType as CustomFieldEntityType;

    const results = await Promise.all(
      body.fields.map((field) =>
        prisma.customFieldValue.upsert({
          where: {
            fieldDefinitionId_entityType_entityId: {
              fieldDefinitionId: field.fieldDefinitionId,
              entityType,
              entityId: body.entityId,
            },
          },
          update: {
            value: field.value,
          },
          create: {
            orgId: auth.orgId,
            fieldDefinitionId: field.fieldDefinitionId,
            entityType,
            entityId: body.entityId,
            value: field.value,
          },
        })
      )
    );

    return NextResponse.json({ data: results });
  } catch (err) {
    console.error("POST /api/crm/custom-field-values failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
