import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Diagnostic endpoint to check for User.id vs auth user_id mismatches.
 * ADMIN only.
 * 
 * Returns:
 * - aligned: users where User.id === auth user_id (correct)
 * - mismatched: users where User.id !== auth user_id (needs migration)
 * - orphanedPrismaUsers: Prisma Users with no auth.users entry
 * - orphanedAuthUsers: auth.users with no Prisma User entry
 */
export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  
  const roleError = requireRole(authResult.auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const { orgId } = authResult.auth;

  // Get all Prisma Users in this org
  const prismaUsers = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, email: true, name: true, role: true },
  });

  // Get all user_org_roles mappings for this org
  const orgRoles = await prisma.$queryRawUnsafe<
    { user_id: string; role: string }[]
  >(
    `SELECT user_id::text, role FROM user_org_roles WHERE org_id = $1::uuid`,
    orgId
  );

  // Get auth.users by their IDs from user_org_roles
  const authUserIds = orgRoles.map((r) => r.user_id);
  
  let authUsers: { id: string; email: string }[] = [];
  if (authUserIds.length > 0) {
    authUsers = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
      `SELECT id::text, email FROM auth.users WHERE id = ANY($1::uuid[])`,
      authUserIds
    );
  }

  // Build lookup maps
  const prismaByEmail = new Map(prismaUsers.map((u) => [u.email.toLowerCase(), u]));
  const authByEmail = new Map(authUsers.map((u) => [u.email.toLowerCase(), u]));

  const aligned: any[] = [];
  const mismatched: any[] = [];
  const orphanedPrismaUsers: any[] = [];

  // Check each Prisma user
  for (const prismaUser of prismaUsers) {
    const emailKey = prismaUser.email.toLowerCase();
    const authUser = authByEmail.get(emailKey);

    if (!authUser) {
      orphanedPrismaUsers.push({
        prismaUserId: prismaUser.id,
        email: prismaUser.email,
        reason: "No auth.users entry found for this email",
      });
      continue;
    }

    if (prismaUser.id === authUser.id) {
      aligned.push({
        email: prismaUser.email,
        id: prismaUser.id,
        status: "OK",
      });
    } else {
      mismatched.push({
        email: prismaUser.email,
        prismaUserId: prismaUser.id,
        authUserId: authUser.id,
        status: "MISMATCH - needs migration",
      });
    }
  }

  // Check for auth users with no Prisma user
  const orphanedAuthUsers: any[] = [];
  for (const authUser of authUsers) {
    const emailKey = authUser.email.toLowerCase();
    if (!prismaByEmail.has(emailKey)) {
      orphanedAuthUsers.push({
        authUserId: authUser.id,
        email: authUser.email,
        reason: "Auth user exists but no Prisma User record",
      });
    }
  }

  const summary = {
    totalPrismaUsers: prismaUsers.length,
    totalAuthUsers: authUsers.length,
    aligned: aligned.length,
    mismatched: mismatched.length,
    orphanedPrismaUsers: orphanedPrismaUsers.length,
    orphanedAuthUsers: orphanedAuthUsers.length,
    needsMigration: mismatched.length > 0,
  };

  return NextResponse.json({
    summary,
    details: {
      aligned,
      mismatched,
      orphanedPrismaUsers,
      orphanedAuthUsers,
    },
  });
}
