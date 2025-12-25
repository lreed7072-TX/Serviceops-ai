import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
export const runtime = "nodejs";


type CustomerPayload = {
  name?: string;
  status?: string;
};

export async function GET(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const customers = await prisma.customer.findMany({
    where: { orgId: authResult.auth.orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: customers });
}

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<CustomerPayload>(request);
  if (!body?.name) {
    return jsonError("Customer name is required.");
  }

  const customer = await prisma.customer.create({
    data: {
      orgId: authResult.auth.orgId,
      name: body.name,
      status: body.status ?? "ACTIVE",
    },
  });

  return NextResponse.json({ data: customer }, { status: 201 });
}
