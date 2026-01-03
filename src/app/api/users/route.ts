import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;

  // Only return users that still have org access (exists in user_org_roles)
  const rows = await prisma.$queryRawUnsafe(
    `
    select
      u.id,
      u."orgId",
      u.email,
      u.name,
      u.role,
      u."createdAt",
      u."updatedAt"
    from "User" u
    join auth.users au
      on lower(au.email) = lower(u.email)
    join user_org_roles uor
      on uor.user_id = au.id
     and uor.org_id = u."orgId"
    where u."orgId" = $1::uuid
    order by u."createdAt" desc
    `,
    authResult.auth.orgId
  );

  return NextResponse.json({ data: rows });
}
