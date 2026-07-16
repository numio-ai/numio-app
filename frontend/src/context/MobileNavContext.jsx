import React, { createContext, useContext, useState, useCallback } from "react";

const MobileNavContext = createContext(null);

export function MobileNavProvider({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatActive, setChatActive] = useState(false);

  const openMenu = useCallback(() => {
    setChatActive(false);
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const activateChat = useCallback(() => {
    setMenuOpen(false);
    setChatActive(true);
  }, []);

  const deactivateChat = useCallback(() => setChatActive(false), []);

  return (
    <MobileNavContext.Provider
      value={{ menuOpen, chatActive, openMenu, closeMenu, activateChat, deactivateChat }}
    >
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}
