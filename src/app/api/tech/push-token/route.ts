import { NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const result = await requireAuthSessionFirst(request);
  if ("error" in result) return result.error;
  const { auth } = result;

  let body: { token?: string; platform?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { token, platform } = body;

  if (!token || typeof token !== "string" || token.length > 512) {
    return NextResponse.json(
      { error: "Missing or invalid push token." },
      { status: 400 }
    );
  }

  if (platform !== "ios" && platform !== "android") {
    return NextResponse.json(
      { error: "Platform must be 'ios' or 'android'." },
      { status: 400 }
    );
  }

  // Ensure push_tokens table exists, then upsert
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      org_id UUID NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, token)
    )
  `);

  await prisma.$executeRawUnsafe(
    `INSERT INTO push_tokens (user_id, org_id, token, platform, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, now())
     ON CONFLICT (user_id, token)
     DO UPDATE SET platform = $4, org_id = $2::uuid, updated_at = now()`,
    auth.userId,
    auth.orgId,
    token,
    platform
  );

  return NextResponse.json({ success: true });
}
