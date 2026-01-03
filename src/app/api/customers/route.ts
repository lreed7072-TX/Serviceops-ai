import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type CustomerPayload = {
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

export async function GET(request: Request) {
const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  try {
    const whereBase: any = { orgId: auth.orgId };
      if (auth.role === Role.TECH) {
        whereBase.workOrders = {
          some: {
            OR: [
              { tasks: { some: { assignedToId: auth.userId } } },
              { visits: { some: { assignedTechId: auth.userId } } },
              { packages: { some: { leadTechId: auth.userId } } },
            ],
          },
        };
      }

      const customers = await prisma.customer.findMany({
        where: whereBase,

      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: customers });
  } catch (err) {
    console.error("GET /api/customers failed:", err);
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;


    const roleError = requireRole(auth, [Role.ADMIN, Role.DISPATCHER]);
    if (roleError) return roleError;
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
          primaryEmail: body.primaryEmail ?? null,
          primaryPhone: body.primaryPhone ?? null,
          billingAddress: body.billingAddress ?? null,
          billingStreet1: body.billingStreet1 ?? null,
          billingStreet2: body.billingStreet2 ?? null,
          billingCity: body.billingCity ?? null,
          billingState: body.billingState ?? null,
          billingPostalCode: body.billingPostalCode ?? null,
          billingCountry: body.billingCountry ?? null,
          notes: body.notes ?? null,
        },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers failed:", err);
    return jsonError("Internal server error.", 500);
  }
}
