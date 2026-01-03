import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { InviteStatus } from "@prisma/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type AcceptPayload = {
  token?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<AcceptPayload>(request);
  if (!body?.token) return jsonError("Invite token is required.", 400);
  if (!body?.password || body.password.length < 8) {
    return jsonError("Password must be at least 8 characters.", 400);
  }

  const invite = await prisma.invite.findUnique({ where: { token: body.token } });
  if (!invite) return jsonError("Invite not found.", 404);
  if (invite.status !== InviteStatus.PENDING) return jsonError("Invite already used.", 409);
  if (invite.expiresAt < new Date()) return jsonError("Invite expired.", 410);

  // Ensure Org exists (satisfy FK constraints)
  await prisma.org.upsert({
    where: { id: invite.orgId },
    update: {},
    create: { id: invite.orgId, name: "Default Org" },
  });

  const supabaseAdmin = createSupabaseAdminClient();

  // Find existing auth user by email (auth schema).
  const rows = await prisma.$queryRawUnsafe(
    `select id::text as id from auth.users where email = $1 limit 1`,
    invite.email
  );
  const existingAuthId = (rows as any[])[0]?.id as string | undefined;

  let authUserId: string;

  if (existingAuthId) {
    // User exists -> set/update password (admin)
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingAuthId, {
      password: body.password,
      email_confirm: true,
    });
    if (error || !data?.user) return NextResponse.json({ error: error?.message ?? "Failed to update user." }, { status: 500 });
    authUserId = data.user.id;
  } else {
    // Create user (admin)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
    });
    if (error || !data?.user) return NextResponse.json({ error: error?.message ?? "Failed to create user." }, { status: 500 });
    authUserId = data.user.id;
  }

  // Ensure Prisma User exists (used by /users + task assignment UI)
  await prisma.user.upsert({
    where: { orgId_email: { orgId: invite.orgId, email: invite.email } },
    update: { role: invite.role },
    create: { orgId: invite.orgId, email: invite.email, role: invite.role, name: null },
  });

  // Ensure org mapping exists (session auth)
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO user_org_roles (user_id, org_id, role)
    VALUES ($1::uuid, $2::uuid, $3)
    ON CONFLICT (user_id, org_id)
    DO UPDATE SET role = EXCLUDED.role
    `,
    authUserId,
    invite.orgId,
    invite.role
  );

  await prisma.invite.update({
    where: { id: invite.id },
    data: { status: InviteStatus.ACCEPTED },
  });

  return NextResponse.json({ ok: true, data: { email: invite.email } });
}
