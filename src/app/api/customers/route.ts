import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

type CustomerPayload = {
  name?: string;
  status?: string;
};

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

export async function GET(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  try {
    const customers = await prisma.customer.findMany({
      where: { orgId: authResult.auth.orgId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: customers });
  } catch (err) {
    console.error("GET /api/customers failed:", err);
    // In preview/dev we return the message so you can see the real cause.
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 }
    );
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
        orgId: authResult.auth.orgId,
        name: body.name,
        status: body.status ?? "ACTIVE",
      },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers failed:", err);
    return NextResponse.json(
      { error: errorMessage(err) },
      { status: 500 }
    );
  }
}
