import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
export const runtime = "nodejs";

type CustomerUpdatePayload = {
  name?: string;
  status?: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  billingAddress?: string | null;
  billingStreet1?: string | null;
  billingStreet2?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingPostalCode?: string | null;
  billingCountry?: string | null;
  notes?: string | null;
};

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
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
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  
  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;
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
        primaryEmail: body.primaryEmail ?? existing.primaryEmail,
        primaryPhone: body.primaryPhone ?? existing.primaryPhone,
        billingAddress: body.billingAddress ?? existing.billingAddress,
        billingStreet1: body.billingStreet1 ?? existing.billingStreet1,
        billingStreet2: body.billingStreet2 ?? existing.billingStreet2,
        billingCity: body.billingCity ?? existing.billingCity,
        billingState: body.billingState ?? existing.billingState,
        billingPostalCode: body.billingPostalCode ?? existing.billingPostalCode,
        billingCountry: body.billingCountry ?? existing.billingCountry,
        notes: body.notes ?? existing.notes,
    },
  });

  return NextResponse.json({ data: customer });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  
  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;
const existing = await prisma.customer.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });

  if (!existing) {
    return jsonError("Customer not found.", 404);
  }

  await prisma.customer.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
