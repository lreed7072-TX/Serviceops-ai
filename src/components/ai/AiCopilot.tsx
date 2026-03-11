"use client";

/**
 * AiCopilot — Floating chat panel for the AI Copilot.
 *
 * Features:
 * - Fixed bottom-right toggle button (orange circle)
 * - Expandable sidebar panel (400px)
 * - Message list with user/assistant bubbles
 * - Text input with send button
 * - Loading indicator during AI response
 * - Conversation list with new/delete/switch
 * - Context-aware: reads pathname for page context
 * - Auto-scroll to latest message
 * - Keyboard: Enter to send, Shift+Enter for newline
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import "./AiCopilot.css";

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  _count: { messages: number };
}

type PanelView = "chat" | "conversations";

// ============================================
// HELPERS
// ============================================

/** Derive entityType and entityId from the current URL path. */
function derivePageContext(pathname: string): {
  entityType?: string;
  entityId?: string;
  path: string;
} {
  const ctx: { entityType?: string; entityId?: string; path: string } = {
    path: pathname,
  };

  // Match patterns like /assets/[id], /work-orders/[id], /customers/[id], etc.
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const entitySegment = segments[segments.length - 2];
    const idSegment = segments[segments.length - 1];

    // UUID pattern check (basic)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idSegment
      );

    if (isUuid) {
      const typeMap: Record<string, string> = {
        assets: "ASSET",
        "work-orders": "WORK_ORDER",
        customers: "CUSTOMER",
        quotes: "QUOTE",
        invoices: "INVOICE",
        sites: "SITE",
        "pm-schedules": "PM_SCHEDULE",
      };
      const mapped = typeMap[entitySegment];
      if (mapped) {
        ctx.entityType = mapped;
        ctx.entityId = idSegment;
      }
    }
  }

  return ctx;
}

/** Format a date string to relative time. */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const MAX_MESSAGE_LENGTH = 2000;

// ============================================
// COMPONENT
// ============================================

export default function AiCopilot() {
  // Panel state
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<PanelView>("chat");

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Input state
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Loading
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  // ── Auto-scroll ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  // ── Load conversations ──
  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const res = await apiFetch("/api/ai/conversations");
      if (res.ok) {
        const json = await res.json();
        setConversations(json.conversations || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  // ── Load messages for active conversation ──
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    try {
      const res = await apiFetch(
        `/api/ai/conversations/${convId}/messages`
      );
      if (res.ok) {
        const json = await res.json();
        setMessages(json.messages || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Load conversations on open
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || trimmed.length > MAX_MESSAGE_LENGTH) return;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Auto-resize textarea back to min
    if (textareaRef.current) {
      textareaRef.current.style.height = "38px";
    }

    try {
      const pageContext = derivePageContext(pathname);
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId: activeConversationId || undefined,
          pageContext,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMsg =
          errorData?.error || "Failed to get a response. Please try again.";
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: errorMsg,
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      const data = await res.json();

      // Set conversation ID if new
      if (!activeConversationId && data.conversationId) {
        setActiveConversationId(data.conversationId);
      }

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.response,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Refresh conversation list
      loadConversations();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [
    input,
    sending,
    activeConversationId,
    pathname,
    loadConversations,
  ]);

  // ── Keyboard handler ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // ── Auto-resize textarea ──
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      // Auto-resize
      const el = e.target;
      el.style.height = "38px";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    []
  );

  // ── New conversation ──
  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setView("chat");
    textareaRef.current?.focus();
  }, []);

  // ── Select conversation ──
  const selectConversation = useCallback(
    (convId: string) => {
      setActiveConversationId(convId);
      setView("chat");
    },
    []
  );

  // ── Delete conversation ──
  const deleteConversation = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const res = await apiFetch(`/api/ai/conversations/${convId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== convId));
          if (activeConversationId === convId) {
            setActiveConversationId(null);
            setMessages([]);
          }
        }
      } catch {
        // Silent fail
      }
    },
    [activeConversationId]
  );

  // ── Toggle panel ──
  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // ── Render ──
  return (
    <>
      {/* Toggle Button */}
      <button
        className={`ai-copilot-toggle ${isOpen ? "open" : ""}`}
        onClick={togglePanel}
        aria-label={isOpen ? "Close AI Copilot" : "Open AI Copilot"}
        title="AI Copilot"
      >
        {isOpen ? "\u2715" : "\u2728"}
      </button>

      {/* Panel */}
      <aside className={`ai-copilot-panel ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="ai-copilot-header">
          <div className="ai-copilot-header-left">
            <span className="ai-copilot-icon">{"\u2728"}</span>
            <h3>AI Copilot</h3>
          </div>
          <div className="ai-copilot-header-actions">
            <button
              className="ai-copilot-header-btn"
              onClick={() =>
                setView(view === "conversations" ? "chat" : "conversations")
              }
              title={
                view === "conversations" ? "Back to chat" : "View conversations"
              }
            >
              {view === "conversations" ? "Chat" : "History"}
            </button>
            <button
              className="ai-copilot-header-btn"
              onClick={startNewConversation}
              title="New conversation"
            >
              + New
            </button>
          </div>
        </div>

        {/* Conversations List View */}
        {view === "conversations" && (
          <div className="ai-copilot-convos">
            {loadingConvos ? (
              <div className="ai-copilot-convos-empty">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="ai-copilot-convos-empty">
                No conversations yet. Start chatting!
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`ai-copilot-convo-item ${
                    activeConversationId === conv.id ? "active" : ""
                  }`}
                  onClick={() => selectConversation(conv.id)}
                >
                  <div>
                    <div className="ai-copilot-convo-title">
                      {conv.title || "Untitled"}
                    </div>
                    <div className="ai-copilot-convo-date">
                      {formatRelativeTime(conv.lastMessageAt)} &middot;{" "}
                      {conv._count.messages} msgs
                    </div>
                  </div>
                  <button
                    className="ai-copilot-convo-delete"
                    onClick={(e) => deleteConversation(conv.id, e)}
                    title="Delete conversation"
                  >
                    {"\u2715"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Chat View */}
        {view === "chat" && (
          <>
            {/* Messages */}
            <div className="ai-copilot-messages">
              {messages.length === 0 && !loadingMessages && (
                <div className="ai-copilot-welcome">
                  <div className="ai-copilot-welcome-icon">{"\u2728"}</div>
                  <h4>ServiceOps AI Copilot</h4>
                  <p>
                    Ask me about work orders, assets, measurements, PM
                    schedules, quotes, or anything in your ServiceOps data.
                  </p>
                </div>
              )}

              {loadingMessages && messages.length === 0 && (
                <div className="ai-copilot-convos-empty">
                  Loading messages...
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`ai-copilot-message ${msg.role}`}
                >
                  {msg.content}
                </div>
              ))}

              {sending && (
                <div className="ai-copilot-typing">
                  <div className="ai-copilot-typing-dot" />
                  <div className="ai-copilot-typing-dot" />
                  <div className="ai-copilot-typing-dot" />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="ai-copilot-input-area">
              <div className="ai-copilot-input-row">
                <textarea
                  ref={textareaRef}
                  className="ai-copilot-textarea"
                  placeholder="Ask the AI Copilot..."
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={sending}
                />
                <button
                  className="ai-copilot-send-btn"
                  onClick={sendMessage}
                  disabled={
                    sending ||
                    !input.trim() ||
                    input.trim().length > MAX_MESSAGE_LENGTH
                  }
                  title="Send message"
                >
                  {"\u2191"}
                </button>
              </div>
              {input.length > 0 && (
                <div
                  className={`ai-copilot-char-count ${
                    input.length > MAX_MESSAGE_LENGTH ? "over" : ""
                  }`}
                >
                  {input.length}/{MAX_MESSAGE_LENGTH}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
