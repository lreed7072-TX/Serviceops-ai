import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

type AssetUpdatePayload = {
  name?: string;
  serial?: string | null;
  description?: string | null;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const asset = await prisma.asset.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!asset) {
    return jsonError("Asset not found.", 404);
  }

  return NextResponse.json({ data: asset });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<AssetUpdatePayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  const existing = await prisma.asset.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Asset not found.", 404);
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      serial: body.serial ?? existing.serial,
      description: body.description ?? existing.description,
    },
  });

  return NextResponse.json({ data: asset });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const existing = await prisma.asset.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Asset not found.", 404);
  }

  await prisma.asset.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
