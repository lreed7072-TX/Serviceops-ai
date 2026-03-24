/**
 * ai-copilot.ts — Main handler for the AI Copilot chat feature.
 *
 * Manages multi-turn conversations with Claude, including tool use loops.
 * Stores all messages in AiConversation / AiMessage tables for history.
 *
 * Flow:
 *  1. Get or create AiConversation
 *  2. Load recent message history
 *  3. Build system prompt + page context
 *  4. Store user message
 *  5. Call Claude with tools
 *  6. Handle tool use loop (max 5 iterations)
 *  7. Store assistant response
 *  8. Return response text
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "./anthropic";
import { AI_COPILOT_MODEL, AI_COPILOT_MAX_TOKENS } from "./ai-prompts";
import {
  copilotToolDefinitions,
  executeCopilotTool,
} from "./copilot-tools";

// ============================================
// TYPES
// ============================================

export interface CopilotPageContext {
  entityType?: string;
  entityId?: string;
  path?: string;
}

export interface CopilotResponse {
  conversationId: string;
  response: string;
  tokensUsed: number;
}

/** Max tool-use round-trips before forcing a text response */
const MAX_TOOL_ITERATIONS = 5;

/** Max messages to load for conversation context */
const MAX_CONTEXT_MESSAGES = 20;

/** Max tokens per conversation turn before graceful stop */
const MAX_TURN_TOKENS = 25000;

/** Approximate max input size in characters before pre-trimming (rough ~4 chars/token) */
const MAX_INPUT_CHARS = 80000;

// ============================================
// SYSTEM PROMPT
// ============================================

const COPILOT_SYSTEM_PROMPT = `You are an AI assistant for ServiceOpsIQ, a rotating equipment service management platform. You help field technicians, dispatchers, and admins answer questions about their work orders, assets, measurements, maintenance schedules, and business data.

Use the available tools to look up real data before answering. Be concise and actionable. If the user is viewing a specific entity, prefer querying that entity first.

Guidelines:
- Always query data before answering questions — do not guess or assume.
- Be concise and direct. Many users are field technicians on mobile devices.
- Reference specific entities by name and number when available.
- When asked about equipment status, include the last service date and any open work orders.
- Flag any safety concerns immediately and prominently.
- Format responses for readability: use short paragraphs, bullet points for lists.
- If you cannot find requested data, say so clearly rather than fabricating information.`;

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Handle a copilot chat message. Creates or continues a conversation,
 * executes tool calls as needed, and returns the final assistant response.
 */
export async function handleCopilotMessage(
  orgId: string,
  userId: string,
  conversationId: string | null,
  userMessage: string,
  pageContext?: CopilotPageContext
): Promise<CopilotResponse> {
  // 1. Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, orgId, userId },
    });
    if (!conversation) {
      throw new Error("Conversation not found");
    }
  }

  if (!conversation) {
    conversation = await prisma.aiConversation.create({
      data: {
        orgId,
        userId,
        title: userMessage.slice(0, 100),
        lastMessageAt: new Date(),
      },
    });
  }

  // 2. Fetch recent messages for context
  // Load most recent messages (desc) then reverse for chronological order
  const existingMessages = (await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: MAX_CONTEXT_MESSAGES,
    select: {
      role: true,
      content: true,
      toolCalls: true,
    },
  })).reverse();

  // 3. Build message history for Claude
  const claudeMessages: Anthropic.MessageParam[] = [];

  for (const msg of existingMessages) {
    if (msg.role === "user") {
      claudeMessages.push({ role: "user", content: msg.content });
    } else if (msg.role === "assistant") {
      claudeMessages.push({ role: "assistant", content: msg.content });
    }
    // Skip tool_result messages in reconstruction — they are part of the
    // tool use flow and are not needed for multi-turn context
  }

  // 4. Build system prompt with optional page context
  let systemPrompt = COPILOT_SYSTEM_PROMPT;
  if (pageContext) {
    const contextParts: string[] = [];
    if (pageContext.path) {
      contextParts.push(`The user is currently viewing: ${pageContext.path}`);
    }
    if (pageContext.entityType && pageContext.entityId) {
      contextParts.push(
        `They are looking at a ${pageContext.entityType} with ID: ${pageContext.entityId}`
      );
    }
    if (contextParts.length > 0) {
      systemPrompt += `\n\nCurrent page context:\n${contextParts.join("\n")}`;
    }
  }

  // 5. Store user message
  await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
    },
  });

  // Add user message to Claude messages
  claudeMessages.push({ role: "user", content: userMessage });

  // 6. Call Claude with tool use loop
  const client = getAnthropicClient();
  let totalTokensUsed = 0;
  let finalResponse = "";
  let iterations = 0;

  // Current messages for this turn (may include tool results)
  let currentMessages: Anthropic.MessageParam[] = [...claudeMessages];

  // Pre-trim if conversation history is too large
  const estimatedChars = currentMessages.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return sum + content.length;
  }, 0);
  if (estimatedChars > MAX_INPUT_CHARS && currentMessages.length > 4) {
    currentMessages = [
      currentMessages[0], // Keep first message for context
      ...currentMessages.slice(-3), // Keep last 3 messages
    ];
  }

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    // Token budget guard — stop gracefully if we've used too many tokens this turn
    if (totalTokensUsed > MAX_TURN_TOKENS) {
      if (!finalResponse) {
        finalResponse = "I've reached the processing limit for this response. Please send a follow-up message to continue.";
      }
      break;
    }

    let response;
    try {
      response = await client.messages.create({
        model: AI_COPILOT_MODEL,
        max_tokens: AI_COPILOT_MAX_TOKENS,
        system: systemPrompt,
        messages: currentMessages,
        tools: copilotToolDefinitions,
      });
    } catch (err: unknown) {
      // Handle context length exceeded by trimming history and retrying once
      const isContextExceeded =
        err instanceof Error &&
        (err.message.includes("context_length_exceeded") ||
          err.message.includes("too long"));
      if (isContextExceeded && currentMessages.length > 2) {
        // Keep only the system context (first msg is implicit) + last 4 messages
        currentMessages = currentMessages.slice(-4);
        console.warn("[copilot] Context exceeded, retrying with trimmed history");
        response = await client.messages.create({
          model: AI_COPILOT_MODEL,
          max_tokens: AI_COPILOT_MAX_TOKENS,
          system: systemPrompt,
          messages: currentMessages,
          tools: copilotToolDefinitions,
        });
      } else {
        throw err;
      }
    }

    totalTokensUsed +=
      response.usage.input_tokens + response.usage.output_tokens;

    // Check if response contains tool use blocks
    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use"
    );
    const textBlocks = response.content.filter(
      (block) => block.type === "text"
    );

    // If no tool calls, extract text and we are done
    if (toolUseBlocks.length === 0) {
      finalResponse = textBlocks
        .map((block) => {
          if (block.type === "text") return block.text;
          return "";
        })
        .join("\n")
        .trim();
      break;
    }

    // Claude wants to use tools — add assistant response with tool_use blocks
    currentMessages.push({
      role: "assistant",
      content: response.content,
    });

    // Execute each tool and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      if (block.type === "tool_use") {
        let toolResult: string;
        try {
          toolResult = await executeCopilotTool(
            block.name,
            (block.input as Record<string, unknown>) || {},
            orgId
          );
        } catch (err) {
          console.error(`[copilot] Tool ${block.name} failed:`, err);
          toolResult = JSON.stringify({ error: "Tool execution failed. Please try a different query." });
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: toolResult,
        });
      }
    }

    // Add tool results as a user message (Anthropic API format)
    currentMessages.push({
      role: "user",
      content: toolResults,
    });

    // If Claude also returned text alongside tool calls, capture it
    if (textBlocks.length > 0 && response.stop_reason === "end_turn") {
      finalResponse = textBlocks
        .map((block) => {
          if (block.type === "text") return block.text;
          return "";
        })
        .join("\n")
        .trim();
      break;
    }
  }

  // Safety: if we hit max iterations without a text response
  if (!finalResponse) {
    finalResponse =
      "I was unable to fully process your request after multiple data lookups. Could you try rephrasing your question?";
  }

  // 7. Store assistant response
  await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: finalResponse,
      tokensUsed: totalTokensUsed,
    },
  });

  // 8. Update conversation metadata
  await prisma.aiConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      // Set title from first message if conversation was just created
      ...(existingMessages.length === 0
        ? { title: userMessage.slice(0, 100) }
        : {}),
    },
  });

  return {
    conversationId: conversation.id,
    response: finalResponse,
    tokensUsed: totalTokensUsed,
  };
}
