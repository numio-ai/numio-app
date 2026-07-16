import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Inbox, DollarSign, Server, MessageSquare, MoreHorizontal } from "lucide-react";
import { useMobileNav } from "../context/MobileNavContext";

const tabs = [
  { id: "inbox", label: "Inbox", icon: Inbox, path: "/inbox" },
  { id: "usage", label: "Usage", icon: DollarSign, path: "/ai-usage" },
  { id: "resources", label: "Resources", icon: Server, path: "/resources" },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "more", label: "More", icon: MoreHorizontal },
];

function isTabActive(tabId, pathname, chatActive, menuOpen) {
  if (tabId === "chat") return chatActive;
  if (tabId === "more") return menuOpen;
  if (tabId === "inbox") return pathname === "/" || pathname.startsWith("/inbox");
  if (tabId === "usage")
    return (
      pathname.startsWith("/ai-usage") ||
      pathname.startsWith("/cloud-usage") ||
      pathname.startsWith("/usage")
    );
  if (tabId === "resources") return pathname.startsWith("/resources");
  return false;
}

export default function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { menuOpen, chatActive, openMenu, closeMenu, activateChat, deactivateChat } =
    useMobileNav();

  const handleTab = (tab) => {
    if (tab.id === "chat") {
      activateChat();
    } else if (tab.id === "more") {
      if (menuOpen) closeMenu();
      else openMenu();
    } else {
      deactivateChat();
      closeMenu();
      navigate(tab.path);
    }
  };

  return (
    <nav className="mobile-tab-bar" aria-label="Mobile navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isTabActive(tab.id, location.pathname, chatActive, menuOpen);
        return (
          <button
            key={tab.id}
            type="button"
            className={`mobile-tab-bar__tab${active ? " mobile-tab-bar__tab--active" : ""}`}
            onClick={() => handleTab(tab)}
            aria-label={tab.label}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
            <span className="mobile-tab-bar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
