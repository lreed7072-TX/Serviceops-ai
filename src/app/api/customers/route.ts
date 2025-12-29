import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
import { getAuthContextFromSupabase } from "@/lib/auth";

export const runtime = "nodejs";

type CustomerPayload = {
  name?: string;
  status?: string;
};

export async function GET(request: Request) {
const authResult = (await getAuthContextFromSupabase()) ?? requireAuth(request);
  const auth = ("auth" in (authResult as any) ? (authResult as any).auth : authResult) as any;

  if ("error" in authResult) return authResult.error;

  try {
    const customers = await prisma.customer.findMany({
      where: { orgId: auth.orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: customers });
  } catch (err) {
    console.error("GET /api/customers failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  try {
    const body = await parseJson<CustomerPayload>(request);
    if (!body?.name) {
      return jsonError("Customer name is required.");
    }

    const customer = await prisma.customer.create({
      data: {
        orgId: auth.orgId,
        name: body.name,
        status: body.status ?? "ACTIVE",
      },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
