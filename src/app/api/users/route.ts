import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN, Role.DISPATCHER]);
  if (roleError) return roleError;

  const users = await prisma.user.findMany({
    where: { orgId: authResult.auth.orgId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: users,
    currentUserId: authResult.auth.userId,
  });
}
