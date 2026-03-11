/**
 * DELETE /api/ai/conversations/[id] — Delete a conversation and its messages.
 *
 * Messages are deleted automatically via Prisma onDelete: Cascade.
 * Only allows deletion of conversations belonging to the authenticated user.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthSessionFirst } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
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

  await prisma.aiConversation.delete({
    where: { id: conversationId },
  });

  return NextResponse.json({ success: true });
}
