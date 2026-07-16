import React from "react";
import { useLocation } from "react-router-dom";
import {
  Plus, Send, X, ChevronLeft,
  Pencil, Trash2, Check, MessageSquare, AlertCircle,
} from "lucide-react";
import { useChat } from "./ChatProvider";
import { useChatSidebar } from "../context/ChatSidebarContext";

const basePrompts = [
  "Summarize my biggest cost drivers this week",
  "Find anomalies in AWS spend over last 7 days",
  "Suggest top 3 savings actions with low risk",
  "What's our policy on idle GPU cleanup?",
];

const escapeHtml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const renderMarkdown = (value) => {
  const safe = escapeHtml(value);
  const bold = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const code = bold.replace(/`([^`]+)`/g, "<code>$1</code>");
  return code.replace(/\n/g, "<br />");
};

const getContextPrompts = (path) => {
  if (path.startsWith("/inbox")) {
    return ["Summarize today's cost changes", "Explain this alert", "What changed vs baseline?"];
  }
  if (path.startsWith("/recommendations") || path.startsWith("/autopilot")) {
    return ["Explain why this recommendation is high-priority", "Show savings impact over time", "Group similar recommendations"];
  }
  if (path.startsWith("/resources")) {
    return ["Show me all idle resources", "Which services are over-utilized?", "Tag unallocated resources"];
  }
  if (path.startsWith("/govern") || path.startsWith("/policies") || path.startsWith("/budgets") || path.startsWith("/tag-governance")) {
    return ["What's our policy on GPU usage?", "Show active policy violations", "Create a budget guardrail"];
  }
  return basePrompts;
};

const formatRelativeTime = (isoString) => {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/* ------------------------------------------------------------------ */
/*  Data table for structured responses                                */
/* ------------------------------------------------------------------ */

function DataTable({ data }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const columns = Object.keys(data[0]);
  if (columns.length === 0) return null;

  return (
    <div className="chatTable__wrap">
      <table className="chatTable">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} className="chatTable__th">{col.replace(/_/g, " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="chatTable__tr">
              {columns.map((col) => (
                <td key={col} className="chatTable__td">
                  {row[col] != null ? String(row[col]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Session list view                                                  */
/* ------------------------------------------------------------------ */

function SessionList({ sessions, activeSessionId, onSwitch, onRename, onDelete }) {
  const [editingId, setEditingId] = React.useState(null);
  const [editValue, setEditValue] = React.useState("");
  const editRef = React.useRef(null);

  React.useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const startRename = (session) => {
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="chatSessions">
      <div className="chatSessions__list">
        {sessions.length === 0 && (
          <div className="chatSessions__empty">No sessions yet</div>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`chatSessions__item ${session.id === activeSessionId ? "chatSessions__item--active" : ""}`}
          >
            {editingId === session.id ? (
              <div className="chatSessions__editRow">
                <input
                  ref={editRef}
                  className="chatSessions__editInput"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={commitRename}
                />
                <button type="button" className="chatSessions__actionBtn" onClick={commitRename} title="Save">
                  <Check size={14} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="chatSessions__itemBtn"
                  onClick={() => onSwitch(session.id)}
                >
                  <MessageSquare size={14} strokeWidth={1.5} className="chatSessions__icon" />
                  <span className="chatSessions__title">{session.title}</span>
                  <span className="chatSessions__time">{formatRelativeTime(session.updatedAt)}</span>
                </button>
                <div className="chatSessions__actions">
                  <button type="button" className="chatSessions__actionBtn" onClick={() => startRename(session)} title="Rename">
                    <Pencil size={13} strokeWidth={2} />
                  </button>
                  <button type="button" className="chatSessions__actionBtn chatSessions__actionBtn--danger" onClick={() => onDelete(session.id)} title="Delete">
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ChatPanel (push sidebar content)                              */
/* ------------------------------------------------------------------ */

export default function ChatPanel({ forceMobileOpen = false }) {
  const location = useLocation();
  const {
    isOpen,
    messages,
    sessions,
    activeSessionId,
    isTyping,
    prefill,
    error,
    openChat,
    closeChat,
    clearError,
    sendMessage,
    newSession,
    switchSession,
    renameSession,
    deleteSession,
  } = useChat();
  const { collapsed } = useChatSidebar();
  const [inputValue, setInputValue] = React.useState("");
  const [showSessions, setShowSessions] = React.useState(false);
  const messagesEndRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (prefill) {
      setInputValue(prefill);
      inputRef.current?.focus();
    }
  }, [prefill]);

  React.useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [isOpen, messages, isTyping]);

  // Close session list when sidebar closes
  React.useEffect(() => {
    if (collapsed) setShowSessions(false);
  }, [collapsed]);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closeChat();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeChat]);

  const prompts = messages.length === 0 ? basePrompts : getContextPrompts(location.pathname);

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handlePromptClick = (prompt) => {
    sendMessage(prompt);
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = () => {
    newSession();
    setShowSessions(false);
  };

  if (collapsed && !forceMobileOpen) return null;

  // Session list view
  if (showSessions) {
    return (
      <div className="chatPanel__sidebar">
        <header className="chatPanel__header">
          <button type="button" className="chatSessions__back" onClick={() => setShowSessions(false)}>
            <ChevronLeft size={16} strokeWidth={2} />
            Chat History
          </button>
          <div className="chatPanel__actions">
            <button type="button" className="chatPanel__close" onClick={closeChat} aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </header>
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitch={switchSession}
          onRename={renameSession}
          onDelete={deleteSession}
        />
      </div>
    );
  }

  // Chat view
  return (
    <div className="chatPanel__sidebar" role="dialog" aria-label="Numio Assistant">
      <header className="chatPanel__header">
        <div className="chatPanel__actions">
          <button type="button" className="chatPanel__ghost" onClick={handleNewSession} title="New chat">
            <Plus size={16} strokeWidth={2} /> New
          </button>
          {sessions.length > 0 && (
            <button type="button" className="chatPanel__ghost" onClick={() => setShowSessions(true)} title="Session history">
              History
            </button>
          )}
          <button type="button" className="chatPanel__close" onClick={closeChat} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {error && (
        <div className="chatPanel__error" role="alert">
          <AlertCircle size={14} strokeWidth={2} />
          <span className="chatPanel__errorText">{error}</span>
          <button type="button" className="chatPanel__errorClose" onClick={clearError} aria-label="Dismiss">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="chatPanel__messages">
        {messages.length === 0 && (
          <div className="chatPanel__empty">
            <h2 className="chatPanel__emptyHeadline">Where should we begin?</h2>
            <p className="chatPanel__emptySub">Ask anything about your costs, alerts, or recommendations.</p>
            <div className="chatPanel__promptGrid">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chatPanel__prompt"
                  onClick={() => handlePromptClick(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chatBubble chatBubble--${msg.role}`}>
            <div
              className={`chatBubble__content ${msg.role === "assistant" ? "explanation-text numio-reasoning" : ""}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || "") }}
            />
            {msg.data && <DataTable data={msg.data} />}
          </div>
        ))}

        {isTyping && (
          <div className="chatBubble chatBubble--assistant">
            <div className="chatBubble__content chatPanel__typing">Thinking…</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatPanel__inputWrap">
        {messages.length > 0 && (
          <div className="chatPanel__promptRow">
            {getContextPrompts(location.pathname).slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chatPanel__promptInline"
                onClick={() => handlePromptClick(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="chatPanel__inputBar">
          <button type="button" className="chatPanel__attach" onClick={handleNewSession} aria-label="New chat" title="New chat">
            <Plus size={20} strokeWidth={2} />
          </button>
          <textarea
            ref={inputRef}
            className="chatPanel__textarea"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask anything"
            rows={1}
          />
          <button
            type="button"
            className="chatPanel__send"
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Send message"
          >
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
