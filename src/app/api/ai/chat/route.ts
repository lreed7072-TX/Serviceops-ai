/**
 * POST /api/ai/chat — AI Copilot chat endpoint.
 *
 * Accepts a user message, forwards it to the copilot handler with
 * tool-calling support, and returns the AI response.
 *
 * Body: { message: string; conversationId?: string; pageContext?: { entityType?, entityId?, path? } }
 * Returns: { conversationId: string; response: string; tokensUsed: number }
 */

import { NextResponse } from "next/server";
import { requireAuthSessionFirst } from "@/lib/auth";
import { handleCopilotMessage } from "@/lib/ai/ai-copilot";

export const runtime = "nodejs";

// TODO: Implement rate limiting (e.g., 20 messages/min per user)

export async function POST(request: Request) {
  const authResult = await requireAuthSessionFirst(request);
  if ("error" in authResult) return authResult.error;
  const { auth } = authResult;

  let body: {
    message?: string;
    conversationId?: string;
    pageContext?: { entityType?: string; entityId?: string; path?: string };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { message, conversationId, pageContext } = body;

  // Validate message
  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "message is required and must be a string" },
      { status: 400 }
    );
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { error: "message must be 2000 characters or less" },
      { status: 400 }
    );
  }

  if (message.trim().length === 0) {
    return NextResponse.json(
      { error: "message cannot be empty" },
      { status: 400 }
    );
  }

  try {
    const result = await handleCopilotMessage(
      auth.orgId,
      auth.userId,
      conversationId || null,
      message.trim(),
      pageContext
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ai/chat] Copilot error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `AI Copilot error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
