import React, { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useChat } from "./ChatProvider";

const RECENT_KEY = "numio_command_palette_recent";

function getRecentQueries() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentQuery(text) {
  try {
    const prev = getRecentQueries();
    const next = [text, ...prev.filter((q) => q !== text)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (_) {}
}

const SUGGESTED_ACTIONS = [
  { label: "What's my MTD spend?", prefill: "What's my MTD spend?" },
  { label: "Show budget alerts", prefill: "Show budget alerts" },
  { label: "Explain cost anomaly", prefill: "Explain the recent cost anomaly" },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [recentQueries, setRecentQueries] = useState([]);
  const inputRef = useRef(null);
  const { openChat } = useChat();

  useEffect(() => {
    if (open) {
      setQuery("");
      setRecentQueries(getRecentQueries());
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = query.trim();
    if (text) {
      openChat(text);
      saveRecentQuery(text);
    }
    onClose();
  };

  const handleAction = (prefill) => {
    openChat(prefill);
    saveRecentQuery(prefill);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="command-palette-overlay" role="dialog" aria-modal="true" aria-label="Ask Numio">
      <div className="command-palette-backdrop" onClick={onClose} aria-hidden />
      <div className="command-palette">
        <form onSubmit={handleSubmit} className="command-palette-form">
          <Search size={18} strokeWidth={1.75} className="command-palette-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Ask Numio..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Ask Numio"
            autoComplete="off"
          />
          <span className="command-palette-kbd">↵</span>
        </form>
        {recentQueries.length > 0 && (
          <div className="command-palette-suggestions">
            <p className="command-palette-suggestions-label">Recent</p>
            {recentQueries.map((q) => (
              <button
                key={q}
                type="button"
                className="command-palette-suggestion"
                onClick={() => handleAction(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="command-palette-suggestions">
          <p className="command-palette-suggestions-label">Suggested</p>
          {SUGGESTED_ACTIONS.map((item) => (
            <button
              key={item.prefill}
              type="button"
              className="command-palette-suggestion"
              onClick={() => handleAction(item.prefill)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
