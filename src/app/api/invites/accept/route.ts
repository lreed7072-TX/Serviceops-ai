import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJson } from "@/lib/api";
import { InviteStatus } from "@prisma/client";

type AcceptInvitePayload = {
  token?: string;
  name?: string | null;
};

export async function POST(request: Request) {
  const body = await parseJson<AcceptInvitePayload>(request);
  if (!body?.token) {
    return jsonError("Invite token is required.");
  }

  const invite = await prisma.invite.findUnique({
    where: { token: body.token },
  });

  if (!invite) {
    return jsonError("Invite not found.", 404);
  }

  if (invite.status !== InviteStatus.PENDING) {
    return jsonError("Invite is no longer valid.", 410);
  }

  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.EXPIRED },
    });
    return jsonError("Invite has expired.", 410);
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: invite.email, orgId: invite.orgId },
  });

  if (existingUser) {
    return jsonError("User already exists for this org.", 409);
  }

  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        orgId: invite.orgId,
        email: invite.email,
        name: body.name ?? null,
        role: invite.role,
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: InviteStatus.ACCEPTED },
    }),
  ]);

  return NextResponse.json({ data: user }, { status: 201 });
}
