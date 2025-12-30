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

const blockIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

const propsSchema = z.object({}).passthrough();

const blockUpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(200, { message: "Title must be 200 characters or fewer." })
      .nullable()
      .optional(),
    props: propsSchema.optional(),
    sortOrder: z
      .number()
      .int()
      .min(0, { message: "Sort order must be 0 or greater." })
      .optional(),
  })
  .strip();

const formatValidationError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(" ");

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const parsedId = blockIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Block ID must be a valid UUID or CUID.", 400);
  }

  const existing = await prisma.reportBlock.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Report block not found.", 404);
  }

  const body = await parseJson<unknown>(request);
  const parsedBody = blockUpdateSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return jsonError(formatValidationError(parsedBody.error), 400);
  }

  const payload = parsedBody.data;
  const updateData: Prisma.ReportBlockUncheckedUpdateInput = {};

  if (payload.title !== undefined) {
    updateData.title = payload.title;
  }
  if (payload.props !== undefined) {
    updateData.props = payload.props as Prisma.InputJsonValue;
  }
  if (payload.sortOrder !== undefined) {
    updateData.sortOrder = payload.sortOrder;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ data: existing });
  }

  const updated = await prisma.reportBlock.update({
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

  const parsedId = blockIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Block ID must be a valid UUID or CUID.", 400);
  }

  const existing = await prisma.reportBlock.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Report block not found.", 404);
  }

  await prisma.reportBlock.delete({ where: { id: existing.id } });
  return NextResponse.json({ data: { id: existing.id } });
}
