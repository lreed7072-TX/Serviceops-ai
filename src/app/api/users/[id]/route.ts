import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

type PatchPayload = {
  role?: Role;
};

async function getAuthUserIdByEmail(email: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe(
    `select id::text as id from auth.users where lower(email) = lower($1) limit 1`,
    email
  );
  return (rows as any[])[0]?.id ?? null;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const body = await parseJson<PatchPayload>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  if (body.role && !Object.values(Role).includes(body.role)) {
    return jsonError("Invalid role.", 400);
  }
  if (!body.role) return jsonError("Role is required.", 400);

  const user = await prisma.user.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!user) return jsonError("User not found.", 404);

  const authUserId = await getAuthUserIdByEmail(user.email);
  if (!authUserId) return jsonError("Auth user not found for this email.", 404);

  // Safety: prevent demoting yourself below ADMIN
  if (authUserId === authResult.auth.userId && body.role !== Role.ADMIN) {
    return jsonError("You cannot demote yourself.", 400);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: body.role },
  });

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO user_org_roles (user_id, org_id, role)
    VALUES ($1::uuid, $2::uuid, $3)
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = EXCLUDED.role
    `,
    authUserId,
    authResult.auth.orgId,
    body.role
  );

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;

  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  const roleError = requireRole(authResult.auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const user = await prisma.user.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!user) return jsonError("User not found.", 404);

  const authUserId = await getAuthUserIdByEmail(user.email);
  if (!authUserId) return jsonError("Auth user not found for this email.", 404);

  // Safety: prevent removing yourself
  if (authUserId === authResult.auth.userId) {
    return jsonError("You cannot remove your own access.", 400);
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM user_org_roles WHERE org_id = $1::uuid AND user_id = $2::uuid`,
    authResult.auth.orgId,
    authUserId
  );

  return NextResponse.json({ ok: true });
}
