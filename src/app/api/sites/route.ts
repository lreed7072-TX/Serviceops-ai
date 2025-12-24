import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";

type SitePayload = {
  customerId?: string;
  name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export async function GET(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const sites = await prisma.site.findMany({
    where: { orgId: authResult.auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: sites });
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<SitePayload>(request);
  if (!body?.customerId || !body?.name) {
    return jsonError("Customer ID and site name are required.");
  }

  const customer = await prisma.customer.findFirst({
    where: { id: body.customerId, orgId: authResult.auth.orgId },
  });

  if (!customer) {
    return jsonError("Customer not found.", 404);
  }

  const site = await prisma.site.create({
    data: {
      orgId: authResult.auth.orgId,
      customerId: customer.id,
      name: body.name,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      postalCode: body.postalCode ?? null,
      country: body.country ?? null,
    },
  });

  return NextResponse.json({ data: site }, { status: 201 });
}
