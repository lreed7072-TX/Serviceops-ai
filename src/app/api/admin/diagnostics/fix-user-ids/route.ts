import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Migration endpoint to fix User.id vs auth user_id mismatches.
 * ADMIN only.
 * 
 * POST with { dryRun: true } to preview changes (default)
 * POST with { dryRun: false } to actually apply fixes
 */
export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  
  const roleError = requireRole(authResult.auth, [Role.ADMIN]);
  if (roleError) return roleError;

  const { orgId } = authResult.auth;
  
  let body: { dryRun?: boolean } = { dryRun: true };
  try {
    body = await request.json();
  } catch {
    // default to dry run
  }
  const dryRun = body.dryRun !== false;

  // Find mismatches (same logic as diagnostic endpoint)
  const prismaUsers = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, orgId: true, email: true, name: true, role: true },
  });

  const orgRoles = await prisma.$queryRawUnsafe<{ user_id: string }[]>(
    `SELECT user_id::text FROM user_org_roles WHERE org_id = $1::uuid`,
    orgId
  );

  const authUserIds = orgRoles.map((r) => r.user_id);
  
  let authUsers: { id: string; email: string }[] = [];
  if (authUserIds.length > 0) {
    authUsers = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
      `SELECT id::text, email FROM auth.users WHERE id = ANY($1::uuid[])`,
      authUserIds
    );
  }

  const authByEmail = new Map(authUsers.map((u) => [u.email.toLowerCase(), u]));

  // Find mismatches
  const mismatches: { prismaUser: typeof prismaUsers[0]; authUserId: string }[] = [];
  
  for (const prismaUser of prismaUsers) {
    const authUser = authByEmail.get(prismaUser.email.toLowerCase());
    if (authUser && prismaUser.id !== authUser.id) {
      mismatches.push({ prismaUser, authUserId: authUser.id });
    }
  }

  if (mismatches.length === 0) {
    return NextResponse.json({
      message: "No mismatches found. All User.id values already match auth user_id.",
      fixed: 0,
    });
  }

  const fixes: any[] = [];

  if (dryRun) {
    // Just report what would be fixed
    for (const { prismaUser, authUserId } of mismatches) {
      fixes.push({
        email: prismaUser.email,
        oldId: prismaUser.id,
        newId: authUserId,
        action: "WOULD UPDATE (dry run)",
      });
    }

    return NextResponse.json({
      dryRun: true,
      message: `Found ${mismatches.length} mismatch(es). Run with { dryRun: false } to apply fixes.`,
      wouldFix: fixes,
    });
  }

  // Actually fix the mismatches
  for (const { prismaUser, authUserId } of mismatches) {
    const oldId = prismaUser.id;
    const newId = authUserId;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Create new User with correct ID
        await tx.user.create({
          data: {
            id: newId,
            orgId: prismaUser.orgId,
            email: prismaUser.email,
            name: prismaUser.name,
            role: prismaUser.role,
          },
        });

        // 2. Update all FK references from oldId to newId
        await tx.taskInstance.updateMany({
          where: { assignedToId: oldId },
          data: { assignedToId: newId },
        });

        await tx.workPackage.updateMany({
          where: { leadTechId: oldId },
          data: { leadTechId: newId },
        });

        await tx.visit.updateMany({
          where: { assignedTechId: oldId },
          data: { assignedTechId: newId },
        });

        await tx.invite.updateMany({
          where: { invitedById: oldId },
          data: { invitedById: newId },
        });

        await tx.taskEvidence.updateMany({
          where: { createdByUserId: oldId },
          data: { createdByUserId: newId },
        });

        await tx.reportTemplate.updateMany({
          where: { createdByUserId: oldId },
          data: { createdByUserId: newId },
        });

        await tx.reportTemplate.updateMany({
          where: { updatedByUserId: oldId },
          data: { updatedByUserId: newId },
        });

        // 3. Delete the old User record
        await tx.user.delete({ where: { id: oldId } });
      });

      fixes.push({
        email: prismaUser.email,
        oldId,
        newId,
        action: "FIXED",
      });
    } catch (err: any) {
      fixes.push({
        email: prismaUser.email,
        oldId,
        newId,
        action: "FAILED",
        error: err?.message ?? String(err),
      });
    }
  }

  const successCount = fixes.filter((f) => f.action === "FIXED").length;
  const failCount = fixes.filter((f) => f.action === "FAILED").length;

  return NextResponse.json({
    dryRun: false,
    message: `Fixed ${successCount} user(s), ${failCount} failed.`,
    fixed: fixes,
  });
}
