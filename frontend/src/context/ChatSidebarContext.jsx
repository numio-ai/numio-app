import React from "react";

const STORAGE_KEY = "numio_chat_sidebar";

const ChatSidebarContext = React.createContext({
  collapsed: true,
  setCollapsed: () => {},
});

function getInitialCollapsed() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "expanded") return false;
    if (v === "collapsed") return true;
    return true; // default collapsed
  } catch {
    return true;
  }
}

export function ChatSidebarProvider({ children }) {
  const [collapsed, setCollapsedState] = React.useState(getInitialCollapsed);

  const setCollapsed = React.useCallback((valueOrUpdater) => {
    setCollapsedState((prev) => {
      const next = typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch (_) {}
      return next;
    });
  }, []);

  const value = React.useMemo(() => ({ collapsed, setCollapsed }), [collapsed, setCollapsed]);

  return (
    <ChatSidebarContext.Provider value={value}>
      {children}
    </ChatSidebarContext.Provider>
  );
}

export function useChatSidebar() {
  const ctx = React.useContext(ChatSidebarContext);
  return ctx || { collapsed: true, setCollapsed: () => {} };
}
