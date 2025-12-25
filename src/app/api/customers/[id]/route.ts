import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";
export const runtime = "nodejs";


type CustomerUpdatePayload = {
  name?: string;
  status?: string;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const customer = await prisma.customer.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!customer) {
    return jsonError("Customer not found.", 404);
  }

  return NextResponse.json({ data: customer });
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const body = await parseJson<CustomerUpdatePayload>(request);
  if (!body) {
    return jsonError("Invalid JSON body.");
  }

  const existing = await prisma.customer.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Customer not found.", 404);
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      status: body.status ?? existing.status,
    },
  });

  return NextResponse.json({ data: customer });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const existing = await prisma.customer.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Customer not found.", 404);
  }

  await prisma.customer.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
