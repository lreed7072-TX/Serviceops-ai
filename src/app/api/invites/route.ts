import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";
export const runtime = "nodejs";

type InvitePayload = {
  email?: string;
  role?: Role;
};

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN]);
  if (roleError) return roleError;


  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;


  const body = await parseJson<InvitePayload>(request);
  if (!body?.email || !body?.role) {
    return jsonError("Email and role are required.");
  }

    const normalizedEmail = body.email.trim().toLowerCase();


  // Re-invite behavior:
  // - If the email still has org access (user_org_roles), block.
  // - If the Prisma User row exists (history), allow invite and keep role consistent.
  const existingUser = await prisma.user.findFirst({
    where: { email: normalizedEmail, orgId: authResult.auth.orgId },
  });

  const hasAccessRows = await prisma.$queryRawUnsafe(
    `select 1
     from auth.users au
     join user_org_roles uor on uor.user_id = au.id
     where uor.org_id = $1::uuid
       and lower(au.email) = lower($2)
     limit 1`,
    authResult.auth.orgId,
    normalizedEmail
  );

  if ((hasAccessRows as any[]).length > 0) {
    return jsonError("User already has access to this org.", 409);
  }

  if (existingUser) {
    await prisma.user
      .update({ where: { id: existingUser.id }, data: { role: body.role } })
      .catch(() => null);
  }

  const ttlHours = Number.parseInt(
    process.env.INVITE_TOKEN_TTL_HOURS ?? "168",
    10
  );
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: {
      orgId: authResult.auth.orgId,
      email: normalizedEmail,
      role: body.role,
      token: randomUUID(),
      expiresAt,
      invitedById: authResult.auth.userId,
    },
  });

  return NextResponse.json({ data: invite, inviteUrl: `${appBase}/invite?token=${invite.token}` }, { status: 201 });
}
