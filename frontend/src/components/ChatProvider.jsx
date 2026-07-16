import React from "react";
import { useChatSidebar } from "../context/ChatSidebarContext";
import * as chatApi from "../api/chat";

const ChatContext = React.createContext(null);

const STORAGE_KEYS = {
  activeSessionId: "numio.chat.activeSessionId",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const autoTitle = (messages) => {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = (firstUser.content || "").slice(0, 50);
  return text.length < (firstUser.content || "").length ? text + "…" : text;
};

/** Map a backend message object to our internal shape. */
const mapMessage = (msg) => ({
  id: msg.id,
  role: msg.role,
  content: msg.content,
  data: msg.data || null,
  timestamp: msg.created_at,
});

/** Map a backend session (list item) to our internal shape. */
const mapSession = (s) => ({
  id: s.id,
  title: s.title || "New chat",
  createdAt: s.created_at,
  updatedAt: s.last_activity_at,
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ChatProvider({ children }) {
  const { collapsed, setCollapsed } = useChatSidebar();
  const isOpen = !collapsed;

  const [sessions, setSessions] = React.useState([]);
  const [activeSessionId, setActiveSessionId] = React.useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.activeSessionId) || null;
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = React.useState([]);
  const [isTyping, setIsTyping] = React.useState(false);
  const [prefill, setPrefill] = React.useState("");
  const [error, setError] = React.useState(null);

  // Persist active session id preference
  React.useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(STORAGE_KEYS.activeSessionId, activeSessionId);
    }
  }, [activeSessionId]);

  // Fetch sessions from backend on mount
  React.useEffect(() => {
    let cancelled = false;
    chatApi.listSessions().then((res) => {
      if (cancelled) return;
      const mapped = (res.sessions || []).map(mapSession);
      setSessions(mapped);
      // Restore active session or pick the first one
      if (mapped.length > 0) {
        const stored = localStorage.getItem(STORAGE_KEYS.activeSessionId);
        const match = mapped.find((s) => s.id === stored);
        setActiveSessionId(match ? match.id : mapped[0].id);
      }
    }).catch(() => {
      // Backend may not be available yet — start with empty state
    });
    return () => { cancelled = true; };
  }, []);

  // Load messages when active session changes
  React.useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    chatApi.getSession(activeSessionId).then((detail) => {
      if (cancelled) return;
      setMessages((detail.messages || []).map(mapMessage));
    }).catch(() => {
      if (!cancelled) setMessages([]);
    });
    return () => { cancelled = true; };
  }, [activeSessionId]);

  // Derived
  const activeSession = React.useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  // --- Actions ---

  const openChat = React.useCallback((text = "") => {
    setCollapsed(false);
    setPrefill(text);
  }, [setCollapsed]);

  const closeChat = React.useCallback(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  const clearError = React.useCallback(() => setError(null), []);

  const newSession = React.useCallback(async () => {
    setError(null);
    try {
      const created = await chatApi.createSession();
      const mapped = mapSession(created);
      setSessions((prev) => [mapped, ...prev]);
      setActiveSessionId(mapped.id);
      setMessages([]);
      setPrefill("");
    } catch (err) {
      setError("Could not create a new chat session. Please try again.");
    }
  }, []);

  const clearChat = React.useCallback(() => {
    newSession();
  }, [newSession]);

  const switchSession = React.useCallback((sessionId) => {
    setActiveSessionId(sessionId);
    setPrefill("");
    setError(null);
  }, []);

  const renameSession = React.useCallback((sessionId, newTitle) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, title: newTitle, updatedAt: new Date().toISOString() }
          : s
      )
    );
  }, []);

  const deleteSession = React.useCallback(
    async (sessionId) => {
      setError(null);
      try {
        await chatApi.deleteSession(sessionId);
      } catch {
        // Best effort — remove locally even if backend fails
      }
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        if (sessionId === activeSessionId) {
          const nextId = next.length > 0 ? next[0].id : null;
          setActiveSessionId(nextId);
          if (!nextId) setMessages([]);
        }
        return next;
      });
    },
    [activeSessionId]
  );

  const sendMessage = React.useCallback(
    async (content) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      setError(null);

      // Ensure we have a session
      let sessionId = activeSessionId;
      if (!sessionId) {
        try {
          const created = await chatApi.createSession();
          const mapped = mapSession(created);
          setSessions((prev) => [mapped, ...prev]);
          setActiveSessionId(mapped.id);
          sessionId = mapped.id;
        } catch {
          setError("Could not create a chat session. Please try again.");
          return;
        }
      }

      // Add user message to UI immediately
      const userMsg = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        data: null,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setPrefill("");
      setIsTyping(true);

      try {
        const response = await chatApi.sendChatMessage(sessionId, trimmed);
        const assistantMsg = {
          id: response.message_id,
          role: "assistant",
          content: response.message,
          data: response.data || null,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => {
          const updated = [...prev, assistantMsg];
          // Auto-title session from first user message
          const session = sessions.find((s) => s.id === sessionId);
          if (session && session.title === "New chat") {
            const newTitle = autoTitle(updated);
            setSessions((prevSessions) =>
              prevSessions.map((s) =>
                s.id === sessionId ? { ...s, title: newTitle } : s
              )
            );
          }
          return updated;
        });
      } catch (err) {
        const status = err.status;
        let msg;
        if (status === 410) {
          msg = "This chat session has expired. Please start a new one.";
        } else if (status === 422) {
          msg = "Message limit reached for this session. Please start a new chat.";
        } else if (status === 503) {
          msg = "The AI service is temporarily unavailable. Please try again in a moment.";
        } else {
          msg = err.message || "Something went wrong. Please try again.";
        }
        setError(msg);
      } finally {
        setIsTyping(false);
      }
    },
    [activeSessionId, sessions]
  );

  const value = React.useMemo(
    () => ({
      isOpen,
      messages,
      sessions,
      activeSessionId,
      activeSession,
      isTyping,
      prefill,
      error,
      openChat,
      closeChat,
      clearChat,
      clearError,
      sendMessage,
      newSession,
      switchSession,
      renameSession,
      deleteSession,
    }),
    [
      isOpen, messages, sessions, activeSessionId, activeSession,
      isTyping, prefill, error, openChat, closeChat, clearChat, clearError,
      sendMessage, newSession, switchSession, renameSession, deleteSession,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = React.useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return ctx;
}
