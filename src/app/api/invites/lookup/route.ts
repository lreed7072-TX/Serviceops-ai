import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api-server";
import { InviteStatus } from "@prisma/client";

export const runtime = "nodejs";

type LookupPayload = { token?: string };

export async function POST(request: Request) {
  const body = await parseJson<LookupPayload>(request);
  if (!body?.token) return jsonError("Invite token is required.", 400);

  const invite = await prisma.invite.findUnique({ where: { token: body.token } });
  if (!invite) return jsonError("Invite not found.", 404);
  if (invite.status !== InviteStatus.PENDING) return jsonError("Invite already used.", 409);
  if (invite.expiresAt < new Date()) return jsonError("Invite expired.", 410);

  const org = await prisma.org.findUnique({ where: { id: invite.orgId } });

  return NextResponse.json({
    ok: true,
    data: {
      email: invite.email,
      role: invite.role,
      orgId: invite.orgId,
      orgName: org?.name ?? "Organization",
      expiresAt: invite.expiresAt,
    },
  });
}
