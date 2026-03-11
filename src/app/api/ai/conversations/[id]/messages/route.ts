/**
 * GET /api/ai/conversations/[id]/messages — List messages for a conversation.
 *
 * Returns messages ordered by createdAt ascending, limited to 100.
 * Only returns messages for conversations belonging to the authenticated user.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  const { id: conversationId } = await params;

  // Verify conversation belongs to user and org
  const conversation = await prisma.aiConversation.findFirst({
    where: {
      id: conversationId,
      orgId: auth.orgId,
      userId: auth.userId,
    },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      role: true,
      content: true,
      tokensUsed: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages }, {
    headers: { "Cache-Control": "no-store" },
  });
}
