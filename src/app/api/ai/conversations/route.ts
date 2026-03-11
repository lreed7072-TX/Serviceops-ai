/**
 * GET /api/ai/conversations — List the current user's AI Copilot conversations.
 *
 * Returns conversations ordered by lastMessageAt descending, limited to 50.
 * Only returns conversations belonging to the authenticated user within their org.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const conversations = await prisma.aiConversation.findMany({
    where: {
      orgId: auth.orgId,
      userId: auth.userId,
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      lastMessageAt: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ conversations });
}
