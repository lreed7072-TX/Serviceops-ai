import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

// POST /api/integrations/qbo/disconnect
// Deactivates the QBO connection for the org
export async function POST(req: NextRequest) {
  const authResult = await requireAuthSessionFirst(req);
  if ("error" in authResult) return authResult.error;
  const { orgId } = authResult.auth;

  const connection = await prisma.qboConnection.findFirst({
    where: { orgId, isActive: true },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No active QBO connection found" },
      { status: 404 }
    );
  }

  await prisma.qboConnection.update({
    where: { id: connection.id },
    data: { isActive: false },
  });

  return NextResponse.json({ data: { disconnected: true } });
}
