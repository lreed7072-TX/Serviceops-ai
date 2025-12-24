import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth, requireRole } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const templateIdSchema = z.union([z.string().uuid(), z.string().cuid()]);

const propsSchema = z.object({}).passthrough();

const blockCreateSchema = z
  .object({
    type: z.enum(["HEADING", "RICH_TEXT", "TABLE", "IMAGE"]),
    title: z
      .string()
      .trim()
      .max(200, { message: "Title must be 200 characters or fewer." })
      .optional(),
    props: propsSchema,
    sortOrder: z
      .number()
      .int()
      .min(0, { message: "Sort order must be 0 or greater." })
      .optional(),
  })
  .strip();

const formatValidationError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(" ");

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const parsedId = templateIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Template ID must be a valid UUID or CUID.", 400);
  }

  const template = await prisma.reportTemplate.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!template) {
    return jsonError("Report template not found.", 404);
  }

  const body = await parseJson<unknown>(request);
  const parsedBody = blockCreateSchema.safeParse(body ?? {});
  if (!parsedBody.success) {
    return jsonError(formatValidationError(parsedBody.error), 400);
  }

  const payload = parsedBody.data;
  const block = await prisma.reportBlock.create({
    data: {
      orgId: authResult.auth.orgId,
      reportTemplateId: template.id,
      type: payload.type,
      title: payload.title ?? null,
      props: payload.props as Prisma.InputJsonValue,
      sortOrder: payload.sortOrder ?? 0,
    },
  });

  return NextResponse.json({ data: block }, { status: 201 });
}
