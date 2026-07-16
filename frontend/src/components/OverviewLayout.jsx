import React from "react";
import { Outlet } from "react-router-dom";
import { Sparkles } from "lucide-react";
import V2Sidebar from "./V2Sidebar";
import ChatPanel from "./ChatPanel";
import MobileTabBar from "./MobileTabBar";
import MobileMenu from "./MobileMenu";
import { useChatSidebar } from "../context/ChatSidebarContext";
import { useMobileNav } from "../context/MobileNavContext";
import useIsMobile from "../hooks/useIsMobile";
import { useChat } from "./ChatProvider";

const CHAT_SIDEBAR_WIDTH = 360;
const MOBILE_TAB_BAR_HEIGHT = 56;

function OverviewLayoutInner() {
  const { collapsed: chatCollapsed } = useChatSidebar();
  const { openChat } = useChat();
  const mobileNav = useMobileNav();
  const isMobile = useIsMobile();
  const chatOpen = !chatCollapsed;

  if (isMobile) {
    const showMobileChat = mobileNav?.chatActive;
    const showMobileMenu = mobileNav?.menuOpen;

    return (
      <div
        className="overview-layout overview-layout--mobile"
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - var(--topnav-height, 44px))",
          overflow: "hidden",
        }}
      >
        <div
          className="overview-layout__content overview-main-content"
          style={{
            flex: 1,
            overflow: "auto",
            paddingBottom: MOBILE_TAB_BAR_HEIGHT,
          }}
        >
          {showMobileChat ? <ChatPanel forceMobileOpen /> : <Outlet />}
        </div>
        {showMobileMenu && <MobileMenu />}
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div
      className="overview-layout sidebarLayout"
      style={{
        display: "flex",
        flexDirection: "row",
        height: "calc(100vh - var(--topnav-height, 44px))",
        overflow: "hidden",
      }}
    >
      <V2Sidebar />
      <div
        className="sidebarLayout__content main-content overview-layout__content overview-main-content"
        style={{ flex: 1, transition: "all 220ms ease", overflow: "auto", minWidth: 0 }}
      >
        <Outlet />
      </div>
      <div
        className="chatSidebar"
        style={{
          width: chatOpen ? CHAT_SIDEBAR_WIDTH : 0,
          minWidth: chatOpen ? CHAT_SIDEBAR_WIDTH : 0,
          maxWidth: chatOpen ? CHAT_SIDEBAR_WIDTH : 0,
          transition: "width 220ms ease, min-width 220ms ease, max-width 220ms ease",
          overflow: "hidden",
          borderLeft: chatOpen ? "1px solid var(--border)" : "none",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ChatPanel />
      </div>
      {chatCollapsed && (
        <button
          type="button"
          className="chatTrigger chatTrigger--pill"
          onClick={() => openChat()}
          aria-label="Ask Numio"
        >
          <Sparkles size={16} strokeWidth={1.75} className="chatTrigger__spark" />
          <span className="chatTrigger__label">Ask Numio</span>
          <span className="chatTrigger__arrow">↗</span>
        </button>
      )}
    </div>
  );
}

/**
 * Layout: left nav sidebar | content | chat sidebar (three-column).
 */
export default function OverviewLayout() {
  return <OverviewLayoutInner />;
}
