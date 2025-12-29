import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
import { getAuthContextFromSupabase } from "@/lib/auth";

export const runtime = "nodejs";

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
  const authResult = (await getAuthContextFromSupabase()) ?? requireAuth(request);
  const auth = ("auth" in (authResult as any) ? (authResult as any).auth : authResult) as any;

if ("error" in authResult) return authResult.error;

  try {
    const sites = await prisma.site.findMany({
      where: { orgId: auth.orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: sites });
  } catch (err) {
    console.error("GET /api/sites failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  const auth = ("auth" in (authResult as any) ? (authResult as any).auth : authResult) as any;
  if ("error" in authResult) return authResult.error;

  try {
    const body = await parseJson<SitePayload>(request);
    if (!body?.customerId || !body?.name) {
      return jsonError("Customer ID and site name are required.");
    }

    const customer = await prisma.customer.findFirst({
      where: { id: body.customerId, orgId: auth.orgId },
    });

    if (!customer) {
      return jsonError("Customer not found.", 404);
    }

    const site = await prisma.site.create({
      data: {
        orgId: auth.orgId,
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
  } catch (err) {
    console.error("POST /api/sites failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
