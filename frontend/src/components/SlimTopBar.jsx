import React, { useCallback, useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Bell, Sun, Moon, MessageSquare, Menu } from "lucide-react";
import { IconNumioMark } from "./Icons";
import { useTheme } from "../context/ThemeContext";
import { useChatSidebar } from "../context/ChatSidebarContext";
import { useMobileNav } from "../context/MobileNavContext";
import { useNotifications } from "../context/NotificationContext";
import useIsMobile from "../hooks/useIsMobile";
import RoleSwitcher from "./RoleSwitcher";
import SystemPill from "./SystemPill";

/** Map notification entity_type + entity_id to a route path. */
function notificationRoute(entityType, entityId) {
  switch (entityType) {
    case "budget": case "budget_alert": return "/govern/budgets";
    case "anomaly": return entityId ? `/anomalies/${entityId}` : "/inbox";
    case "finding": return entityId ? `/anomalies/${entityId}` : "/inbox";
    case "zombie": return "/recommendations";
    case "policy": return "/policies";
    case "recommendation": return "/recommendations";
    default: return "/inbox";
  }
}

function formatTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getPageName(pathname) {
  if (pathname === "/" || pathname.startsWith("/inbox")) return "Inbox";
  if (pathname.startsWith("/ai-usage")) return "AI Usage";
  if (pathname.startsWith("/cloud-usage")) return "Cloud Usage";
  if (pathname.startsWith("/usage")) return "Usage";
  if (pathname.startsWith("/resources")) return "Resources";
  if (pathname.startsWith("/recommendations")) return "Recommendations";
  if (pathname.startsWith("/autopilot")) return "Autopilot";
  if (pathname.startsWith("/tag-governance")) return "Tag Governance";
  if (pathname.startsWith("/budgets")) return "Budgets";
  if (pathname.startsWith("/policies")) return "Policies";
  if (pathname.startsWith("/govern/notifications")) return "Notifications";
  if (pathname.startsWith("/govern/budgets")) return "Budgets";
  if (pathname.startsWith("/govern/policies")) return "Policies";
  if (pathname.startsWith("/govern/guardrails")) return "Guardrails";
  if (pathname.startsWith("/govern/cost-allocation")) return "Cost Allocation";
  if (pathname.startsWith("/govern/audit")) return "Audit Log";
  if (pathname.startsWith("/govern/issues")) return "Issues";
  if (pathname.startsWith("/govern")) return "Govern";
  if (pathname.startsWith("/costs")) return "Costs";
  if (pathname.startsWith("/settings/workspaces")) return "Workspaces";
  if (pathname.startsWith("/settings/access_tokens")) return "API Access";
  if (pathname.startsWith("/settings/audit_logs")) return "Audit Logs";
  if (pathname.startsWith("/settings/payment")) return "Billing";
  if (pathname.startsWith("/settings/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/automation-safety")) return "Automation Safety";
  if (pathname.startsWith("/settings/users")) return "People";
  if (pathname.startsWith("/settings/tags")) return "Tags";
  if (pathname.startsWith("/settings/kubernetes") || pathname.startsWith("/settings/aws")) return "Integrations";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/accounts")) return "Accounts";
  if (pathname.startsWith("/account/profile")) return "Profile";
  if (pathname.startsWith("/anomalies")) return "Anomaly";
  if (pathname.startsWith("/ingestion")) return "Data Ingestion";
  if (pathname.startsWith("/data-explorer")) return "Data Explorer";
  if (pathname.startsWith("/issues")) return "Issues";
  return "Inbox";
}

export default function SlimTopBar({ onOpenCommandPalette }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { dark, setDark } = useTheme();
  const { collapsed: chatCollapsed, setCollapsed: setChatCollapsed } = useChatSidebar();
  const mobileNav = useMobileNav();
  const isMobile = useIsMobile();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);
  const handleKeyDown = useCallback(
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenCommandPalette?.();
      }
    },
    [onOpenCommandPalette]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isMobile) {
    return (
      <header className="slim-top-bar slim-top-bar--mobile top-bar" role="banner">
        <div className="slim-top-bar__left top-bar__left">
          <button
            type="button"
            className="slim-top-bar__action mobile-hamburger"
            onClick={() => mobileNav?.openMenu()}
            aria-label="Open menu"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
        </div>
        <span className="slim-top-bar__page-title">
          {getPageName(location.pathname)}
        </span>
        <div className="slim-top-bar__right">
          <button
            type="button"
            className="slim-top-bar__action"
            title="Notifications"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            onClick={() => setNotifOpen((v) => !v)}
            style={{ position: "relative" }}
          >
            <Bell size={20} strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 2, right: 2,
                minWidth: 16, height: 16, borderRadius: 8,
                background: "#ef4444", color: "#fff",
                fontSize: 10, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px", lineHeight: 1,
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="slim-top-bar slim-top-bar--chatgpt top-bar" role="banner">
      <div className="slim-top-bar__left top-bar__left">
        <Link to="/inbox" className="slim-top-bar__logo top-bar__logo" aria-label="Numio home">
          <IconNumioMark className="slim-top-bar__logo-icon" />
        </Link>
        <span
          className="top-bar__wordmark"
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "#111827",
            letterSpacing: "-0.01em",
          }}
        >
          Numio
        </span>
        <span className="top-bar__breadcrumb-sep" style={{ color: "#d1d5db", fontSize: "14px" }}>
          /
        </span>
        <span className="top-bar__breadcrumb-page" style={{ fontSize: "13px", color: "#6b7280" }}>
          {getPageName(location.pathname)}
        </span>
      </div>

      <div className="slim-top-bar__spacer" />
      <div className="slim-top-bar__right">
        <button
          type="button"
          className="ask-numio-trigger"
          onClick={() => onOpenCommandPalette?.()}
          title="Ask Numio (⌘K)"
          aria-label="Ask Numio (⌘K)"
        >
          <Sparkles width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`slim-top-bar__action${chatCollapsed ? "" : " slim-top-bar__action--active"}`}
          onClick={() => setChatCollapsed((prev) => !prev)}
          title={chatCollapsed ? "Open chat" : "Close chat"}
          aria-label={chatCollapsed ? "Open chat" : "Close chat"}
        >
          <MessageSquare size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="slim-top-bar__action"
          onClick={() => setDark(!dark)}
          title={dark ? "Light mode" : "Dark mode"}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
        </button>
        <div ref={notifRef} style={{ position: "relative", display: "inline-flex" }}>
          <button
            type="button"
            className="slim-top-bar__action"
            title="Notifications"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            aria-haspopup="true"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((v) => !v)}
            style={{ position: "relative" }}
          >
            <Bell size={18} strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                minWidth: 16, height: 16, borderRadius: 8,
                background: "#ef4444", color: "#fff",
                fontSize: 10, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 4px", lineHeight: 1,
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: 4,
              width: 360, maxHeight: 440, overflowY: "auto",
              background: "var(--card, #fff)", border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              zIndex: 200,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text, #111827)" }}>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    style={{ fontSize: 11, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: "32px 14px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                  No notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!n.is_read) markRead(n.id);
                      setNotifOpen(false);
                      navigate(notificationRoute(n.entity_type, n.entity_id));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (!n.is_read) markRead(n.id);
                        setNotifOpen(false);
                        navigate(notificationRoute(n.entity_type, n.entity_id));
                      }
                    }}
                    style={{
                      display: "flex", gap: 10, padding: "10px 14px",
                      borderBottom: "1px solid var(--border-light, #f3f4f6)",
                      cursor: "pointer",
                      background: n.is_read ? "transparent" : "rgba(59,130,246,0.04)",
                      transition: "background 120ms",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        {!n.is_read && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 12, fontWeight: n.is_read ? 400 : 600, color: "var(--text, #111827)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.title}
                        </span>
                      </div>
                      {n.message && (
                        <p style={{ fontSize: 11, color: "#6b7280", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {n.message}
                        </p>
                      )}
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>
                        {n.event_type?.replace(/_/g, " ")} · {formatTimeAgo(n.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <RoleSwitcher />
        <SystemPill />
      </div>
    </header>
  );
}
