import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const templateIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

const definitionSchema = z.object({}).passthrough();

const templateUpdateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "Name must be at least 2 characters." })
      .max(120, { message: "Name must be 120 characters or fewer." })
      .optional(),
    description: z
      .union([
        z
          .string()
          .trim()
          .max(2000, { message: "Description must be 2000 characters or fewer." }),
        z.null(),
      ])
      .optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    schemaVersion: z
      .number()
      .int()
      .min(1, { message: "Schema version must be at least 1." })
      .optional(),
    definition: definitionSchema.optional(),
  })
  .strip();

const formatValidationError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(" ");

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const parsedId = templateIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Template ID must be a valid UUID or CUID.", 400);
  }

  const template = await prisma.reportTemplate.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
    include: {
      blocks: {
        where: { orgId: authResult.auth.orgId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!template) {
    return jsonError("Report template not found.", 404);
  }

  return NextResponse.json({ data: template });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const parsedId = templateIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Template ID must be a valid UUID or CUID.", 400);
  }

  const existing = await prisma.reportTemplate.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Report template not found.", 404);
  }

  const body = await parseJson<unknown>(request);
  const parsedBody = templateUpdateSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return jsonError(formatValidationError(parsedBody.error), 400);
  }

  const payload = parsedBody.data;
  const updateData: Prisma.ReportTemplateUncheckedUpdateInput = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name;
  }
  if (payload.description !== undefined) {
    updateData.description = payload.description ?? null;
  }
  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }
  if (payload.schemaVersion !== undefined) {
    updateData.schemaVersion = payload.schemaVersion;
  }
  if (payload.definition !== undefined) {
    updateData.definition = payload.definition as Prisma.InputJsonValue;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ data: existing });
  }

  updateData.updatedByUserId = authResult.auth.userId;

  const updated = await prisma.reportTemplate.update({
    where: { id: existing.id },
    data: updateData,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const parsedId = templateIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Template ID must be a valid UUID or CUID.", 400);
  }

  const existing = await prisma.reportTemplate.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Report template not found.", 404);
  }

  await prisma.reportTemplate.delete({ where: { id: existing.id } });
  return NextResponse.json({ data: { id: existing.id } });
}
