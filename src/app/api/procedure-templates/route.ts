import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/procedure-templates
 * List all procedure templates with optional filters
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const context = searchParams.get("context");

  const where: any = {
    orgId: authResult.auth.orgId,
    status: "ACTIVE", // Only show active templates by default
  };

  if (category) where.assetCategory = category;
  if (context) where.context = context;

  const templates = await prisma.procedureTemplate.findMany({
    where,
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      standardsPack: {
        select: { id: true, name: true },
      },
      _count: {
        select: { steps: true },
      },
    },
    orderBy: [
      { assetCategory: "asc" },
      { assetFamily: "asc" },
      { name: "asc" },
    ],
  });

  return NextResponse.json({ data: templates });
}

type CreateTemplatePayload = {
  name: string;
  description?: string;
  assetCategory: string;
  assetFamily?: string;
  assetSubfamily?: string;
  context: string;
  estimatedDurationMinutes?: number;
};

/**
 * POST /api/procedure-templates
 * Create a new procedure template
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<CreateTemplatePayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!body.name?.trim()) {
    return jsonError("Template name is required.", 400);
  }

  if (!body.assetCategory?.trim()) {
    return jsonError("Asset category is required.", 400);
  }

  if (!body.context) {
    return jsonError("Context is required.", 400);
  }

  const template = await prisma.procedureTemplate.create({
    data: {
      orgId: authResult.auth.orgId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      assetCategory: body.assetCategory.trim(),
      assetFamily: body.assetFamily?.trim() || null,
      assetSubfamily: body.assetSubfamily?.trim() || null,
      context: body.context,
      estimatedDurationMinutes: body.estimatedDurationMinutes || null,
      version: 1,
      status: "ACTIVE",
      createdById: authResult.auth.userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ data: template });
}
