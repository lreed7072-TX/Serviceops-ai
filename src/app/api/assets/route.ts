import { NextResponse } from "next/server";
import { z, type ZodError, type ZodTypeAny } from "zod";
import { AssetCriticality, AssetStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth, getAuthContextFromSupabase } from "@/lib/auth";
export const runtime = "nodejs";

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      }
      return value;
    },
    z.union([z.string().max(max, { message: `Must be at most ${max} characters.` }), z.null()]).optional()
  );

const allowedNameplateKeys = [
  "voltage",
  "amperage",
  "frequency",
  "horsepower",
  "kilowatts",
  "pressure",
  "temperature",
  "power",
] as const;

const nameplateShape: Record<string, ZodTypeAny> = {};
allowedNameplateKeys.forEach((key) => {
  nameplateShape[key] = z
    .union([
      z.string().trim().max(120, { message: `Nameplate ${key} must be 120 characters or fewer.` }),
      z.number(),
    ])
    .optional();
});

const nameplateSchema = z.object(nameplateShape).strict();

const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Asset name is required." })
  .max(120, { message: "Asset name must be 120 characters or fewer." });

const assetOptionalFields = {
  manufacturer: optionalTrimmedString(80),
  model: optionalTrimmedString(80),
  serialNumber: optionalTrimmedString(80),
  assetTag: optionalTrimmedString(80),
  location: optionalTrimmedString(160),
  notes: optionalTrimmedString(5000),
  status: z.nativeEnum(AssetStatus).optional(),
  criticality: z.union([z.nativeEnum(AssetCriticality), z.null()]).optional(),
  nameplateSchemaVersion: z.number().int().min(1, { message: "Nameplate schema version must be at least 1." }).optional(),
  nameplate: z.union([nameplateSchema, z.null()]).optional(),
};

const assetCreateSchema = z.object({
  customerId: z.string().uuid({ message: "Customer ID must be a valid UUID." }),
  siteId: z.string().uuid({ message: "Site ID must be a valid UUID." }),
  name: nameSchema,
  ...assetOptionalFields,
});

export const assetUpdateSchema = z.object({
  name: nameSchema.optional(),
  ...assetOptionalFields,
});

type AssetCreateInput = z.infer<typeof assetCreateSchema>;
type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
type NameplatePayload =
  | AssetCreateInput["nameplate"]
  | AssetUpdateInput["nameplate"];

export const formatValidationError = (error: ZodError) =>
  error.issues.map((issue) => issue.message).join(" ");

const nullableString = (value: string | null | undefined) =>
  value === undefined ? null : value;

const buildAssetCreateData = (
  orgId: string,
  customerId: string,
  siteId: string,
  payload: AssetCreateInput
) => ({
  orgId,
  customerId,
  siteId,
  name: payload.name,
  manufacturer: nullableString(payload.manufacturer),
  model: nullableString(payload.model),
  serialNumber: nullableString(payload.serialNumber),
  assetTag: nullableString(payload.assetTag),
  location: nullableString(payload.location),
  notes: nullableString(payload.notes),
  status: payload.status ?? AssetStatus.ACTIVE,
  criticality: payload.criticality ?? null,
  nameplateSchemaVersion: payload.nameplateSchemaVersion ?? 1,
  nameplate: serializeNameplate(payload.nameplate),
});

export const buildAssetUpdateData = (payload: AssetUpdateInput) => {
  const data: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    data.name = payload.name;
  }
  const assignNullable = (key: keyof AssetUpdateInput, field: string) => {
    const value = payload[key];
    if (value !== undefined) {
      data[field] = value ?? null;
    }
  };

  assignNullable("manufacturer", "manufacturer");
  assignNullable("model", "model");
  assignNullable("serialNumber", "serialNumber");
  assignNullable("assetTag", "assetTag");
  assignNullable("location", "location");
  assignNullable("notes", "notes");

  if (payload.status !== undefined) {
    data.status = payload.status;
  }

  if (payload.criticality !== undefined) {
    data.criticality = payload.criticality ?? null;
  }

  if (payload.nameplateSchemaVersion !== undefined) {
    data.nameplateSchemaVersion = payload.nameplateSchemaVersion;
  }

  if (payload.nameplate !== undefined) {
    data.nameplate = serializeNameplate(payload.nameplate);
  }

  return data;
};

const serializeNameplate = (
  value: NameplatePayload
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.DbNull;
  }
  return value as Prisma.InputJsonValue;
};

export async function GET(request: Request) {
const authResult = (await getAuthContextFromSupabase()) ?? requireAuth(request);
  const auth = ("auth" in (authResult as any) ? (authResult as any).auth : authResult) as any;

  if ("error" in authResult) return authResult.error;

  const assets = await prisma.asset.findMany({
    where: { orgId: auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: assets });
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  const auth = ("auth" in (authResult as any) ? (authResult as any).auth : authResult) as any;
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<unknown>(request);
  const parsed = assetCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError(formatValidationError(parsed.error), 400);
  }
  const payload = parsed.data;

  const [customer, site] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: payload.customerId, orgId: auth.orgId },
    }),
    prisma.site.findFirst({
      where: { id: payload.siteId, orgId: auth.orgId },
    }),
  ]);

  if (!customer || !site) {
    return jsonError("Customer or site not found.", 404);
  }

  if (site.customerId !== customer.id) {
    return jsonError("Site does not belong to the selected customer.", 400);
  }

  const asset = await prisma.asset.create({
    data: buildAssetCreateData(auth.orgId, customer.id, site.id, payload),
  });

  return NextResponse.json({ data: asset }, { status: 201 });
}
