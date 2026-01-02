import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { InviteStatus } from "@prisma/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AcceptInvitePayload = {
  token?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<AcceptInvitePayload>(request);
  if (!body?.token) {
    return jsonError("Invite token is required.");
  }

  // Must be signed in (works for Google OR email/password OR magic-link).
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json(
      { error: "Please sign in to accept this invite." },
      { status: 401 }
    );
  }

  const authUser = data.user;
  const authEmail = (authUser.email ?? "").toLowerCase();

  const invite = await prisma.invite.findUnique({ where: { token: body.token } });
  if (!invite) return jsonError("Invite not found.", 404);
  if (invite.status !== InviteStatus.PENDING) return jsonError("Invite already used.", 409);
  if (invite.expiresAt < new Date()) return jsonError("Invite expired.", 410);

  // Prevent accepting someone else's invite.
  if (authEmail && invite.email.toLowerCase() !== authEmail) {
    return jsonError("This invite is for a different email.", 403);
  }

  // Ensure Org exists (usually already does).
  await prisma.org.upsert({
    where: { id: invite.orgId },
    update: {},
    create: {
      id: invite.orgId,
      name: "Default Org",
    },
  });

  // Ensure Prisma User exists (used by /api/users + task assignment UI).
  await prisma.user.upsert({
    where: { orgId_email: { orgId: invite.orgId, email: invite.email } },
    update: {
      role: invite.role,
      name:
        (authUser.user_metadata as any)?.full_name ??
        (authUser.user_metadata as any)?.name ??
        undefined,
    },
    create: {
      orgId: invite.orgId,
      email: invite.email,
      name:
        (authUser.user_metadata as any)?.full_name ??
        (authUser.user_metadata as any)?.name ??
        null,
      role: invite.role,
    },
  });

  // Ensure user_org_roles mapping exists (used by session auth).
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO user_org_roles (user_id, org_id, role)
    VALUES ($1::uuid, $2::uuid, $3)
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = EXCLUDED.role
    `,
    authUser.id,
    invite.orgId,
    invite.role
  );

  // Mark invite accepted.
  await prisma.invite.update({
    where: { id: invite.id },
    data: { status: InviteStatus.ACCEPTED },
  });

  return NextResponse.json({
    ok: true,
    data: { orgId: invite.orgId, role: invite.role },
  });
}
