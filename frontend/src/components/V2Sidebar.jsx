import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Inbox,
  DollarSign,
  Server,
  Zap,
  Bot,
  Tags,
  Target,
  Shield,
  Activity,
  Database,
  Settings,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  Clock,
  User,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import useInboxUnreadCount from "../hooks/useInboxUnreadCount";

const NAV_V2 = [
  {
    id: "work",
    label: null,
    items: [
      { id: "inbox", label: "Inbox", icon: Inbox, path: "/inbox", showBadge: true },
    ],
  },
  {
    id: "understand",
    label: "Understand",
    items: [
      { id: "usage", label: "Usage", icon: DollarSign, path: "/usage" },
      { id: "resources", label: "Resources", icon: Server, path: "/resources" },
    ],
  },
  {
    id: "optimize",
    label: "Optimize",
    items: [
      { id: "recommendations", label: "Recommendations", icon: Zap, path: "/recommendations" },
      { id: "autopilot", label: "Autopilot", icon: Bot, path: "/autopilot" },
    ],
  },
  {
    id: "govern",
    label: "Govern",
    items: [
      { id: "tag-governance", label: "Tag Governance", icon: Tags, path: "/tag-governance" },
      { id: "budgets", label: "Budgets", icon: Target, path: "/budgets" },
      { id: "policies", label: "Policies", icon: Shield, path: "/policies" },
    ],
  },
  {
    id: "admin",
    label: null,
    items: [
      { id: "ingestion", label: "Data Ingestion", icon: Activity, path: "/ingestion" },
      { id: "data-explorer", label: "Data Explorer", icon: Database, path: "/data-explorer", adminOnly: true },
      { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
    ],
  },
];

function isItemActive(itemPath, currentPath) {
  return currentPath === itemPath || currentPath.startsWith(itemPath + "/");
}

function findActiveGroupId(currentPath) {
  for (const group of NAV_V2) {
    if (group.items.some((it) => isItemActive(it.path, currentPath))) return group.id;
  }
  return null;
}

export default function V2Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const inboxCount = useInboxUnreadCount();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const visibleNav = NAV_V2.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || isAdmin),
  })).filter((group) => group.items.length > 0);

  const [collapsed, setCollapsed] = useState(() => {
    const activeId = findActiveGroupId(location.pathname);
    const initial = {};
    for (const group of NAV_V2) {
      initial[group.id] = group.label !== null && group.id !== activeId;
    }
    return initial;
  });

  useEffect(() => {
    const activeId = findActiveGroupId(location.pathname);
    if (!activeId) return;
    setCollapsed((prev) => (prev[activeId] === false ? prev : { ...prev, [activeId]: false }));
  }, [location.pathname]);

  const toggleGroup = (id) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = () => setProfileMenuOpen(false);
    const handleEscape = (e) => {
      if (e.key === "Escape") requestAnimationFrame(close);
    };
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        requestAnimationFrame(close);
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileMenuOpen]);

  return (
    <aside
      className="v2-sidebar"
      aria-label="Main navigation"
      style={{
        width: 220,
        minWidth: 220,
        flexShrink: 0,
        borderRight: "1px solid #e5e5e5",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - var(--topnav-height, 44px))",
        position: "sticky",
        top: 0,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>
        <nav>
          {visibleNav.map((group, gi) => {
            const isGroupCollapsed = !!collapsed[group.id];
            const groupContentId = `v2-group-${group.id}`;
            return (
              <React.Fragment key={group.id}>
                {gi > 0 && (
                  <div
                    aria-hidden
                    style={{ height: 1, background: "#e5e5e5", margin: "10px 12px 6px" }}
                  />
                )}
                {group.label && (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={!isGroupCollapsed}
                    aria-controls={groupContentId}
                    onClick={() => toggleGroup(group.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleGroup(group.id);
                      }
                    }}
                    data-testid={`v2-group-label-${group.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "4px 16px 4px 12px",
                      margin: "0 4px 2px",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {group.label}
                    </span>
                    <ChevronDown
                      size={12}
                      strokeWidth={1.5}
                      style={{
                        color: "#9ca3af",
                        transform: isGroupCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        transition: "transform 200ms ease",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                )}
                {!isGroupCollapsed && (
                  <div id={groupContentId} data-testid={`v2-group-items-${group.id}`}>
                    {group.items.map((item) => {
                      const isActive = isItemActive(item.path, location.pathname);
                      const Icon = item.icon;
                      const showBadge = item.showBadge && inboxCount > 0;
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          aria-current={isActive ? "page" : undefined}
                          data-testid={`v2-item-${item.id}`}
                          onClick={() => navigate(item.path)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(item.path);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "7px 12px",
                            margin: "1px 4px",
                            borderRadius: 8,
                            background: isActive ? "#f3f4f6" : "transparent",
                            color: isActive ? "#111827" : "#374151",
                            fontWeight: isActive ? 500 : 400,
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <Icon size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>{item.label}</span>
                          </div>
                          {showBadge && (
                            <span
                              data-testid="v2-inbox-badge"
                              aria-label={`${inboxCount} unread`}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                minWidth: 18,
                                height: 18,
                                padding: "0 6px",
                                borderRadius: 9,
                                background: "#dc2626",
                                color: "#fff",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {inboxCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div
        className="v2-sidebar__footer"
        style={{
          flexShrink: 0,
          borderTop: "1px solid #f0f0f0",
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#ffffff",
        }}
      >
        <div ref={profileMenuRef} style={{ position: "relative", width: "100%" }}>
          <button
            type="button"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((v) => !v)}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: 0,
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#111827",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              JC
            </div>
            <div style={{ overflow: "hidden", minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", whiteSpace: "nowrap" }}>James C.</div>
              <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{user?.role === "admin" ? "Admin" : "Member"}</div>
            </div>
          </button>
          {profileMenuOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              style={{
                position: "absolute",
                bottom: "100%",
                left: 8,
                marginBottom: 8,
                minWidth: 220,
                background: "var(--card, #fff)",
                border: "1px solid var(--border, #e5e5e5)",
                borderRadius: 12,
                boxShadow: "var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))",
                padding: "6px 0",
                zIndex: 100,
              }}
            >
              <Link
                to="/settings?tab=payment"
                role="menuitem"
                onClick={() => requestAnimationFrame(() => setProfileMenuOpen(false))}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", color: "var(--text-primary, #111827)", textDecoration: "none", fontSize: 14 }}
              >
                <Clock size={18} strokeWidth={1.75} style={{ color: "var(--text-muted, #6b7280)", flexShrink: 0 }} />
                <span>Upgrade plan</span>
              </Link>
              <Link
                to="/account/profile"
                role="menuitem"
                onClick={() => requestAnimationFrame(() => setProfileMenuOpen(false))}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", color: "var(--text-primary, #111827)", textDecoration: "none", fontSize: 14 }}
              >
                <User size={18} strokeWidth={1.75} style={{ color: "var(--text-muted, #6b7280)", flexShrink: 0 }} />
                <span>Personalization</span>
              </Link>
              <Link
                to="/settings"
                role="menuitem"
                onClick={() => requestAnimationFrame(() => setProfileMenuOpen(false))}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", color: "var(--text-primary, #111827)", textDecoration: "none", fontSize: 14 }}
              >
                <Settings size={18} strokeWidth={1.75} style={{ color: "var(--text-muted, #6b7280)", flexShrink: 0 }} />
                <span>Settings</span>
              </Link>
              <Link
                to="/account/profile/support"
                role="menuitem"
                onClick={() => requestAnimationFrame(() => setProfileMenuOpen(false))}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", color: "var(--text-primary, #111827)", textDecoration: "none", fontSize: 14 }}
              >
                <HelpCircle size={18} strokeWidth={1.75} style={{ color: "var(--text-muted, #6b7280)", flexShrink: 0 }} />
                <span>Help</span>
                <ChevronRightSmall size={16} style={{ marginLeft: "auto", color: "var(--text-muted, #6b7280)" }} />
              </Link>
              <div
                role="menuitem"
                tabIndex={0}
                onClick={() => requestAnimationFrame(() => setProfileMenuOpen(false))}
                onKeyDown={(e) => e.key === "Enter" && requestAnimationFrame(() => setProfileMenuOpen(false))}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", color: "var(--text-primary, #111827)", fontSize: 14, cursor: "pointer" }}
              >
                <LogOut size={18} strokeWidth={1.75} style={{ color: "var(--text-muted, #6b7280)", flexShrink: 0 }} />
                <span>Log out</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
