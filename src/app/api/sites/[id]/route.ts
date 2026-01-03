import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { Role } from "@prisma/client";
export const runtime = "nodejs";

type SiteUpdatePayload = {
  name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const whereSite: any = { id, orgId: authResult.auth.orgId };
    if (authResult.auth.role === Role.TECH) {
      whereSite.workOrders = {
        some: {
          OR: [
            { tasks: { some: { assignedToId: authResult.auth.userId } } },
            { visits: { some: { assignedTechId: authResult.auth.userId } } },
            { packages: { some: { leadTechId: authResult.auth.userId } } },
          ],
        },
      };
    }

    const site = await prisma.site.findFirst({ where: whereSite });
if (!site) {
    return jsonError("Site not found.", 404);
  }

  return NextResponse.json({ data: site });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<SiteUpdatePayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  const existing = await prisma.site.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Site not found.", 404);
  }

  const site = await prisma.site.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      address: body.address ?? existing.address,
      city: body.city ?? existing.city,
      state: body.state ?? existing.state,
      postalCode: body.postalCode ?? existing.postalCode,
      country: body.country ?? existing.country,
    },
  });

  return NextResponse.json({ data: site });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const existing = await prisma.site.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Site not found.", 404);
  }

  await prisma.site.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
