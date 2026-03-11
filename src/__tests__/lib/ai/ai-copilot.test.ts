import { describe, test, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCKS — vi.mock factories are hoisted, so they cannot reference
// variables declared with const/let. Use inline mock objects instead,
// then import the mocked modules to access the mock fns.
// ============================================

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    aiMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropicClient: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/ai/copilot-tools", () => ({
  copilotToolDefinitions: [
    {
      name: "search_assets",
      description: "Search for assets",
      input_schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  ],
  executeCopilotTool: vi.fn(),
}));

// Import AFTER mocks are defined
import { handleCopilotMessage } from "@/lib/ai/ai-copilot";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { executeCopilotTool } from "@/lib/ai/copilot-tools";

// ============================================
// TYPED MOCK REFERENCES
// ============================================

const mockPrisma = vi.mocked(prisma, true);
const mockGetAnthropicClient = vi.mocked(getAnthropicClient);
const mockExecuteCopilotTool = vi.mocked(executeCopilotTool);

// Shared mock for messages.create that we can configure per test
let mockMessagesCreate: ReturnType<typeof vi.fn>;

// ============================================
// HELPERS
// ============================================

const TEST_ORG_ID = "org-test-123";
const TEST_USER_ID = "user-test-456";
const TEST_CONV_ID = "conv-test-789";

function makeTextResponse(text: string, inputTokens = 100, outputTokens = 50) {
  return {
    content: [{ type: "text" as const, text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    stop_reason: "end_turn",
  };
}

function makeToolUseResponse(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolUseId = "toolu_test_1"
) {
  return {
    content: [
      {
        type: "tool_use" as const,
        id: toolUseId,
        name: toolName,
        input: toolInput,
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
    stop_reason: "tool_use",
  };
}

// ============================================
// SETUP
// ============================================

beforeEach(() => {
  vi.clearAllMocks();

  // Create a fresh mock for messages.create
  mockMessagesCreate = vi.fn();
  mockGetAnthropicClient.mockReturnValue({
    messages: { create: mockMessagesCreate },
  } as unknown as ReturnType<typeof getAnthropicClient>);

  // Default: no existing messages
  mockPrisma.aiMessage.findMany.mockResolvedValue([]);
  mockPrisma.aiMessage.create.mockResolvedValue({ id: "msg-1" } as never);
  mockPrisma.aiConversation.update.mockResolvedValue({} as never);
});

// ============================================
// TESTS
// ============================================

describe("ai-copilot", () => {
  describe("handleCopilotMessage", () => {
    test("creates new conversation when conversationId is null", async () => {
      const newConv = {
        id: TEST_CONV_ID,
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        title: "Test question",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.aiConversation.create.mockResolvedValue(newConv as never);
      mockMessagesCreate.mockResolvedValue(
        makeTextResponse("Here is your answer.")
      );

      const result = await handleCopilotMessage(
        TEST_ORG_ID,
        TEST_USER_ID,
        null,
        "What pumps need maintenance?"
      );

      // Should have created a new conversation
      expect(mockPrisma.aiConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: TEST_ORG_ID,
          userId: TEST_USER_ID,
          title: "What pumps need maintenance?",
        }),
      });

      expect(result.conversationId).toBe(TEST_CONV_ID);
      expect(result.response).toBe("Here is your answer.");
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    test("executes tool calls and returns final text response", async () => {
      const existingConv = {
        id: TEST_CONV_ID,
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        title: "Existing conversation",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.aiConversation.findFirst.mockResolvedValue(existingConv as never);

      // First call returns tool use, second call returns text
      mockMessagesCreate
        .mockResolvedValueOnce(
          makeToolUseResponse("search_assets", { query: "pump" })
        )
        .mockResolvedValueOnce(
          makeTextResponse("I found 3 pumps that need maintenance.")
        );

      mockExecuteCopilotTool.mockResolvedValue(
        JSON.stringify({
          assets: [
            { id: "a1", name: "Main Pump A" },
            { id: "a2", name: "Booster Pump B" },
            { id: "a3", name: "Transfer Pump C" },
          ],
        })
      );

      const result = await handleCopilotMessage(
        TEST_ORG_ID,
        TEST_USER_ID,
        TEST_CONV_ID,
        "Find all pumps"
      );

      // Should have called the tool executor
      expect(mockExecuteCopilotTool).toHaveBeenCalledWith(
        "search_assets",
        { query: "pump" },
        TEST_ORG_ID
      );

      // Should have called Claude twice (tool use + final)
      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);

      expect(result.response).toBe(
        "I found 3 pumps that need maintenance."
      );
      // Tokens from both calls
      expect(result.tokensUsed).toBe(300); // (100+50) * 2
    });

    test("handles max tool iterations gracefully", async () => {
      const existingConv = {
        id: TEST_CONV_ID,
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        title: "Existing conversation",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.aiConversation.findFirst.mockResolvedValue(existingConv as never);

      // Always return tool use — never text
      mockMessagesCreate.mockResolvedValue(
        makeToolUseResponse("search_assets", { query: "pump" })
      );

      mockExecuteCopilotTool.mockResolvedValue(
        JSON.stringify({ assets: [] })
      );

      const result = await handleCopilotMessage(
        TEST_ORG_ID,
        TEST_USER_ID,
        TEST_CONV_ID,
        "Keep searching forever"
      );

      // Should have hit the max iterations (5)
      expect(mockMessagesCreate).toHaveBeenCalledTimes(5);

      // Should return the fallback message
      expect(result.response).toContain(
        "unable to fully process your request"
      );
    });

    test("stores messages in AiMessage table", async () => {
      const newConv = {
        id: TEST_CONV_ID,
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        title: "Test",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.aiConversation.create.mockResolvedValue(newConv as never);
      mockMessagesCreate.mockResolvedValue(
        makeTextResponse("Hello! How can I help?")
      );

      await handleCopilotMessage(
        TEST_ORG_ID,
        TEST_USER_ID,
        null,
        "Hello"
      );

      // Should store user message
      expect(mockPrisma.aiMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: TEST_CONV_ID,
          role: "user",
          content: "Hello",
        }),
      });

      // Should store assistant message
      expect(mockPrisma.aiMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: TEST_CONV_ID,
          role: "assistant",
          content: "Hello! How can I help?",
          tokensUsed: 150,
        }),
      });

      // Total: 2 calls (user + assistant)
      expect(mockPrisma.aiMessage.create).toHaveBeenCalledTimes(2);
    });

    test("includes page context in system prompt", async () => {
      const newConv = {
        id: TEST_CONV_ID,
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        title: "Test",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.aiConversation.create.mockResolvedValue(newConv as never);
      mockMessagesCreate.mockResolvedValue(
        makeTextResponse("Looking at this asset...")
      );

      await handleCopilotMessage(
        TEST_ORG_ID,
        TEST_USER_ID,
        null,
        "What is the status of this asset?",
        {
          entityType: "ASSET",
          entityId: "asset-123",
          path: "/assets/asset-123",
        }
      );

      // Verify Claude was called with system prompt containing page context
      const callArgs = mockMessagesCreate.mock.calls[0][0];
      expect(callArgs.system).toContain("/assets/asset-123");
      expect(callArgs.system).toContain("ASSET");
      expect(callArgs.system).toContain("asset-123");
    });
  });
});
