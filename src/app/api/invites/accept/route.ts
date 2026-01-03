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
  if (!body?.token) return jsonError("Invite token is required.");

  // Must be signed in. Accept either cookie session OR Authorization: Bearer <access_token>.
  const supabase = await createSupabaseServerClient();

  let user = null as any;

  // 1) cookie session
  {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) user = data.user;
  }

  // 2) bearer token fallback (for email/password on /invite)
  if (!user) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) user = data.user;
    }
  }

  if (!user) {
    return NextResponse.json(
      { error: "Please sign in to accept this invite." },
      { status: 401 }
    );
  }

  const authEmail = (user.email ?? "").toLowerCase();

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
    create: { id: invite.orgId, name: "Default Org" },
  });

  // Ensure Prisma User exists (used by /api/users + task assignment UI).
  await prisma.user.upsert({
    where: { orgId_email: { orgId: invite.orgId, email: invite.email } },
    update: {
      role: invite.role,
      name:
        (user.user_metadata as any)?.full_name ??
        (user.user_metadata as any)?.name ??
        undefined,
    },
    create: {
      orgId: invite.orgId,
      email: invite.email,
      name:
        (user.user_metadata as any)?.full_name ??
        (user.user_metadata as any)?.name ??
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
    user.id,
    invite.orgId,
    invite.role
  );

  await prisma.invite.update({
    where: { id: invite.id },
    data: { status: InviteStatus.ACCEPTED },
  });

  return NextResponse.json({ ok: true, data: { orgId: invite.orgId, role: invite.role } });
}
