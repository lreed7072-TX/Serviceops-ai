import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth, requireRole } from "@/lib/auth";
import { Prisma, ReportTemplateStatus, Role } from "@prisma/client";
export const runtime = "nodejs";


const definitionSchema = z.object({}).passthrough();

const templateCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "Name must be at least 2 characters." })
      .max(120, { message: "Name must be 120 characters or fewer." }),
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
    definition: definitionSchema,
  })
  .strip();

const formatValidationError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join(" ");

export async function GET(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const templates = await prisma.reportTemplate.findMany({
    where: { orgId: authResult.auth.orgId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ data: templates });
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const body = await parseJson<unknown>(request);
  const parsed = templateCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError(formatValidationError(parsed.error), 400);
  }

  const payload = parsed.data;
  const template = await prisma.reportTemplate.create({
    data: {
      orgId: authResult.auth.orgId,
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status ?? ReportTemplateStatus.DRAFT,
      schemaVersion: payload.schemaVersion ?? 1,
      definition: payload.definition as Prisma.InputJsonValue,
      createdByUserId: authResult.auth.userId,
      updatedByUserId: authResult.auth.userId,
    },
  });

  return NextResponse.json({ data: template }, { status: 201 });
}
