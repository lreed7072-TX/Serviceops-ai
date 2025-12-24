import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuth, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";

type InvitePayload = {
  email?: string;
  role?: Role;
};

export async function POST(request: Request) {
  const authResult = requireAuth(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const body = await parseJson<InvitePayload>(request);
  if (!body?.email || !body?.role) {
    return jsonError("Email and role are required.");
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: body.email, orgId: authResult.auth.orgId },
  });

  if (existingUser) {
    return jsonError("User already exists for this org.", 409);
  }

  const ttlHours = Number.parseInt(
    process.env.INVITE_TOKEN_TTL_HOURS ?? "168",
    10
  );
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: {
      orgId: authResult.auth.orgId,
      email: body.email,
      role: body.role,
      token: randomUUID(),
      expiresAt,
      invitedById: authResult.auth.userId,
    },
  });

  return NextResponse.json({ data: invite }, { status: 201 });
}
