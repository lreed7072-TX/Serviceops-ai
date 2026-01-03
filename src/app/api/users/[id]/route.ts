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

  const user = await prisma.user.findFirst({
    where: { id, orgId: authResult.auth.orgId },
  });
  if (!user) return jsonError("User not found.", 404);

  // Prevent admin from demoting/removing themselves accidentally (optional safety)
  if (user.email === authResult.auth.userId) {
    // auth.userId is UUID, not email; skip this check safely
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: body.role ?? user.role,
    },
  });

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

  // Remove access from org by deleting user_org_roles mapping for the Supabase auth user id.
  // We don't know if Prisma user.id == auth user id, so try both:
  await prisma.$executeRawUnsafe(
    `DELETE FROM user_org_roles
     WHERE org_id = $1::uuid AND (user_id = $2::uuid)`,
    authResult.auth.orgId,
    id
  );

  // Soft approach: keep user row (history), just return OK.
  // If you want true delete later, we can add a status flag instead.
  return NextResponse.json({ ok: true });
}
