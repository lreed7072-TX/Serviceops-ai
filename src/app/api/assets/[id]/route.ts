import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
import {
  assetUpdateSchema,
  buildAssetUpdateData,
} from "../route";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const assetIdSchema = z.union([z.string().uuid(), z.string().cuid()]);
const numberField = (label: string) =>
  z
    .number({ message: `${label} must be a number.` })
    .refine((value) => Number.isFinite(value), {
      message: `${label} must be a number.`,
    })
    .positive({ message: `${label} must be positive.` });
const shortTextField = (label: string, max = 80) =>
  z.string().trim().max(max, { message: `${label} must be ${max} characters or fewer.` });

const nameplateV1Schema = z
  .object({
    rpm: numberField("RPM").optional(),
    horsepower: numberField("Horsepower").optional(),
    kilowatts: numberField("Kilowatts").optional(),
    voltage: numberField("Voltage").optional(),
    amperage: numberField("Amperage").optional(),
    frequency: numberField("Frequency").optional(),
    phase: shortTextField("Phase").optional(),
    frame: shortTextField("Frame").optional(),
    enclosure: shortTextField("Enclosure").optional(),
  })
  .strict();

const assetNameplateUpdateSchema = assetUpdateSchema
  .extend({
    nameplateSchemaVersion: z.literal(1).optional(),
    nameplate: z.union([nameplateV1Schema, z.null()]).optional(),
  })
  .strict();

const formatNameplateValidationError = (error: z.ZodError) => {
  const issues: string[] = [];

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      const isNameplate = issue.path[0] === "nameplate";
      for (const key of issue.keys) {
        issues.push(
          isNameplate ? `Unknown nameplate field: ${key}.` : `Unknown field: ${key}.`
        );
      }
      continue;
    }

    if (issue.path.length >= 2 && issue.path[0] === "nameplate") {
      issues.push(issue.message);
      continue;
    }

    issues.push(issue.message);
  }

  return {
    error: issues[0] ?? "Invalid request payload.",
    issues,
  };
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const parsedId = assetIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Asset ID must be a valid UUID or CUID.", 400);
  }

  const asset = await prisma.asset.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!asset) {
    return jsonError("Asset not found.", 404);
  }

  return NextResponse.json({ data: asset });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const parsedId = assetIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Asset ID must be a valid UUID or CUID.", 400);
  }

  const existing = await prisma.asset.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Asset not found.", 404);
  }

  const body = await parseJson<unknown>(request);
  const parsed = assetNameplateUpdateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const payload = formatNameplateValidationError(parsed.error);
    return NextResponse.json(payload, { status: 400 });
  }

  const updateData = buildAssetUpdateData(parsed.data);
  if (
    parsed.data.nameplate !== undefined &&
    parsed.data.nameplateSchemaVersion === undefined
  ) {
    updateData.nameplateSchemaVersion = 1;
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ data: existing });
  }

  try {
    const asset = await prisma.asset.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ data: asset });
  } catch (error) {
    console.error(error);
    return jsonError("Unable to update asset.", 500);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const parsedId = assetIdSchema.safeParse(id);
  if (!parsedId.success) {
    return jsonError("Asset ID must be a valid UUID or CUID.", 400);
  }

  const existing = await prisma.asset.findFirst({
    where: { id: parsedId.data, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Asset not found.", 404);
  }

  await prisma.asset.delete({ where: { id: parsedId.data } });

  return NextResponse.json({ data: { id } });
}
