import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

type AssetPayload = {
  customerId?: string;
  siteId?: string;
  name?: string;
  serial?: string | null;
  description?: string | null;
};

export async function GET(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const assets = await prisma.asset.findMany({
    where: { orgId: authResult.auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: assets });
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<AssetPayload>(request);
  if (!body?.customerId || !body?.siteId || !body?.name) {
    return jsonError("Customer ID, site ID, and asset name are required.");
  }

  const [customer, site] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: body.customerId, orgId: authResult.auth.orgId },
    }),
    prisma.site.findFirst({
      where: { id: body.siteId, orgId: authResult.auth.orgId },
    }),
  ]);

  if (!customer || !site) {
    return jsonError("Customer or site not found.", 404);
  }

  const asset = await prisma.asset.create({
    data: {
      orgId: authResult.auth.orgId,
      customerId: customer.id,
      siteId: site.id,
      name: body.name,
      serial: body.serial ?? null,
      description: body.description ?? null,
    },
  });

  return NextResponse.json({ data: asset }, { status: 201 });
}
