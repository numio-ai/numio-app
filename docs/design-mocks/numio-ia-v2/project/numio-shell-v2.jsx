// numio-shell-v2.jsx — IA v2 shell.
// Differences from v1:
//   - Sidebar reorganized into 4 labeled groups (WORK / UNDERSTAND /
//     OPTIMIZE / GOVERN) plus an unlabeled admin group at the bottom.
//   - Groups are collapsible (click the label).
//   - "Overview" surface removed entirely — default landing is Inbox.
//   - Feed → renamed Inbox; promoted to top with unread badge.
//   - Optimize is now action-focused (Recommendations, Zombie Hunter,
//     Autopilot); inventory pages moved out to Resources.
//   - Tag Governance is consolidated and stays first-class.
//   - Top bar: removed "Customize dashboard", merged Data + Autopilot
//     pills into a single "System" badge. 6 controls instead of 8.
const { useState: useStateV2 } = React;

const V2_NS = {
  border: "#e5e5e5",
  borderLight: "#efefef",
  text: "#111827",
  text2: "#374151",
  muted: "#6b7280",
  xMuted: "#9ca3af",
  bg: "#f7f7f7",
  surface: "#ffffff",
  accent: "#2563eb",
  ai: "#6366f1",
  aiBg: "#eef2ff",
  ai2: "#4f46e5",
  success: "#16a34a",
  warn: "#d97706",
  danger: "#dc2626",
};

// ------------------ Icon set (subset of lucide) ------------------
const V2Icon = ({ name, size = 16, color = "currentColor", strokeWidth = 1.5, style }) => {
  const p = {
    inbox:           <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
    dollar:          <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    server:          <><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
    sparkleZap:      <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    skull:           <><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><path d="M8 20v2h8v-2"/><path d="M12.5 17l-.5-1-.5 1"/><path d="M16 20a2 2 0 0 0 2-2v-2a6 6 0 0 0-12 0v2a2 2 0 0 0 2 2"/></>,
    bot:             <><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></>,
    tags:            <><path d="M9 5H2v7l8.5 8.5a2.5 2.5 0 0 0 3.5 0l3.5-3.5a2.5 2.5 0 0 0 0-3.5L9 5z"/><line x1="6" y1="9" x2="6.01" y2="9"/></>,
    target:          <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    shield:          <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    activity:        <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    database:        <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></>,
    settings:        <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    chevronDown:     <><polyline points="6 9 12 15 18 9"/></>,
    panelLeftClose:  <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M16 15l-3-3 3-3"/></>,
    sparkles:        <><path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></>,
    messageSquare:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    moon:            <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    bell:            <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    plus:            <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    send:            <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    x:               <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    chevronRight:    <><polyline points="9 18 15 12 9 6"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {p[name]}
    </svg>
  );
};

const NumioMarkV2 = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect width="24" height="24" rx="6" fill="#111827"/>
    <path d="M7 17V9.5c0-.4.4-.7.8-.5l.4.2c.7.4 1.3.3 2-.1.7-.4 1.5-.6 2.4-.6 2.4 0 4.2 1.7 4.2 4.3V17h-2.2v-3.6c0-1.4-.9-2.3-2.1-2.3-1.3 0-2.3 1-2.3 2.4V17H7z" fill="#fff"/>
  </svg>
);

// ============================================================
// TOP BAR — slimmed: 6 controls. Combined system status pill.
// ============================================================
function NumioTopBarV2({ page = "Inbox" }) {
  return (
    <header style={{
      height: 44, flexShrink: 0,
      borderBottom: `1px solid ${V2_NS.border}`,
      display: "flex", alignItems: "center",
      padding: "0 16px",
      background: V2_NS.surface,
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <NumioMarkV2 size={20} />
        <span style={{ fontSize: 15, fontWeight: 600, color: V2_NS.text, letterSpacing: "-0.01em" }}>Numio</span>
        <span style={{ color: "#d1d5db", fontSize: 14 }}>/</span>
        <span style={{ fontSize: 13, color: V2_NS.muted }}>{page}</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={{ ...v2IconBtn, color: V2_NS.ai }} title="Ask Numio (⌘K)">
          <V2Icon name="sparkles" size={16} color={V2_NS.ai} strokeWidth={1.75} />
        </button>
        <button style={v2IconBtn} title="Chat">
          <V2Icon name="messageSquare" size={18} color={V2_NS.muted} strokeWidth={1.75} />
        </button>
        <button style={v2IconBtn} title="Theme">
          <V2Icon name="moon" size={18} color={V2_NS.muted} strokeWidth={1.75} />
        </button>
        <button style={{ ...v2IconBtn, position: "relative" }} title="Notifications">
          <V2Icon name="bell" size={18} color={V2_NS.muted} strokeWidth={1.75} />
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 14, height: 14, borderRadius: 7,
            background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
          }}>3</span>
        </button>
        <div style={{ width: 1, height: 18, background: V2_NS.border, margin: "0 4px" }} />
        {/* Role badge */}
        <span style={{
          fontSize: 11, color: V2_NS.text2, padding: "3px 10px",
          border: `1px solid ${V2_NS.border}`, borderRadius: 999,
          background: "#fafafa",
        }}>Finance</span>
        {/* Combined System status — replaces separate Data + Autopilot pills */}
        <span style={{
          fontSize: 11, color: V2_NS.text2, padding: "3px 10px",
          border: `1px solid ${V2_NS.border}`, borderRadius: 999,
          background: "#fafafa",
          display: "inline-flex", alignItems: "center", gap: 6,
        }} title="Data synced 2m ago · Autopilot active">
          <span style={{ width: 6, height: 6, borderRadius: 3, background: V2_NS.success }} />
          System
        </span>
      </div>
    </header>
  );
}

const v2IconBtn = {
  width: 32, height: 32,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none", borderRadius: 8, cursor: "pointer",
  padding: 0,
};

// ============================================================
// SIDEBAR (v2) — labeled, collapsible groups.
// ============================================================
const NAV_V2 = [
  {
    id: "work", label: null, // no group label for top
    items: [
      { id: "inbox", label: "Inbox", icon: "inbox", badge: 11 },
    ],
  },
  {
    id: "understand", label: "Understand",
    items: [
      { id: "usage", label: "Usage", icon: "dollar" },
      { id: "resources", label: "Resources", icon: "server" },
    ],
  },
  {
    id: "optimize", label: "Optimize",
    items: [
      { id: "recommendations", label: "Recommendations", icon: "sparkleZap" },
      { id: "autopilot", label: "Autopilot", icon: "bot" },
    ],
  },
  {
    id: "govern", label: "Govern",
    items: [
      { id: "tag-governance", label: "Tag Governance", icon: "tags" },
      { id: "budgets", label: "Budgets", icon: "target" },
      { id: "policies", label: "Policies", icon: "shield" },
    ],
  },
  {
    id: "admin", label: null, // unlabeled at bottom
    items: [
      { id: "ingestion", label: "Data Ingestion", icon: "activity" },
      { id: "data-explorer", label: "Data Explorer", icon: "database" },
      { id: "settings", label: "Settings", icon: "settings" },
    ],
  },
];

function NumioSidebarV2({ activePage = "inbox" }) {
  // Auto-collapse all groups except the one containing the active page.
  const initial = {};
  for (const g of NAV_V2) initial[g.id] = !g.items.some((it) => it.id === activePage) && g.id !== "work";
  // Always show the active group expanded
  for (const g of NAV_V2) if (g.items.some((it) => it.id === activePage)) initial[g.id] = false;
  const [collapsed, setCollapsed] = useStateV2(initial);

  const toggleGroup = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  return (
    <aside style={{
      width: 220, flexShrink: 0, borderRight: `1px solid ${V2_NS.border}`,
      background: V2_NS.surface, display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
        <nav>
          {/* Toggle row */}
          <div style={{ display: "flex", paddingLeft: 12, paddingRight: 12, marginBottom: 4 }}>
            <button style={{ ...v2IconBtn, width: 28, height: 28, color: V2_NS.xMuted }}>
              <V2Icon name="panelLeftClose" size={20} color={V2_NS.xMuted} />
            </button>
          </div>

          {NAV_V2.map((group, gi) => {
            const isCollapsed = collapsed[group.id];
            return (
              <React.Fragment key={group.id}>
                {/* Group separator above (except first) */}
                {gi > 0 && (
                  <div style={{ height: 1, background: V2_NS.border, margin: "10px 12px 6px" }} />
                )}
                {/* Group label, clickable to collapse */}
                {group.label && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "4px 16px 4px 12px",
                      margin: "0 4px 2px",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: V2_NS.xMuted,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>{group.label}</span>
                    <V2Icon name="chevronDown" size={12} color={V2_NS.xMuted}
                      style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
                  </div>
                )}
                {/* Group items */}
                {!isCollapsed && group.items.map((item) => {
                  const isActive = item.id === activePage;
                  return (
                    <div key={item.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 12px", margin: "1px 4px",
                      borderRadius: 8,
                      background: isActive ? "#f3f4f6" : "transparent",
                      color: isActive ? V2_NS.text : V2_NS.text2,
                      fontWeight: isActive ? 500 : 400,
                      cursor: "pointer",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <V2Icon name={item.icon} size={16} color={isActive ? V2_NS.text : V2_NS.text2} strokeWidth={1.5} />
                        <span style={{ fontSize: 13 }}>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          minWidth: 18, height: 18, padding: "0 6px",
                          borderRadius: 9, background: V2_NS.danger, color: "#fff",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}>{item.badge}</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0, borderTop: "1px solid #f0f0f0", padding: 12,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 16, background: V2_NS.text, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 600,
        }}>JC</div>
        <div style={{ overflow: "hidden", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: V2_NS.text }}>James C.</div>
          <div style={{ fontSize: 11, color: V2_NS.xMuted }}>Admin</div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// CHAT PANEL — same as v1, reused.
// ============================================================
function NumioChatPanelV2({ collapsed, onToggle }) {
  if (collapsed) {
    return (
      <button onClick={onToggle} style={{
        position: "absolute", bottom: 20, right: 20, zIndex: 10,
        background: V2_NS.surface, border: `1px solid ${V2_NS.border}`,
        borderRadius: 9999, padding: "8px 14px",
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "Inter, system-ui, sans-serif", fontSize: 13,
        color: V2_NS.text, cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}>
        <V2Icon name="sparkles" size={14} color={V2_NS.ai} strokeWidth={1.75} />
        <span>Ask Numio</span>
        <span style={{ color: V2_NS.xMuted }}>↗</span>
      </button>
    );
  }
  return (
    <aside style={{
      width: 360, flexShrink: 0, borderLeft: `1px solid ${V2_NS.border}`,
      background: V2_NS.surface, display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${V2_NS.border}` }}>
        <button style={{ ...v2IconBtn, width: 28, height: 28 }}>
          <V2Icon name="plus" size={16} color={V2_NS.muted} strokeWidth={2} />
        </button>
        <button style={{ background: "none", border: "none", color: V2_NS.muted, fontSize: 12, marginLeft: 4 }}>History</button>
        <div style={{ flex: 1 }} />
        <button onClick={onToggle} style={{ ...v2IconBtn, width: 28, height: 28 }}>
          <V2Icon name="x" size={16} color={V2_NS.muted} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 8px" }}>
        <h2 style={{ fontSize: 17, fontWeight: 500, color: V2_NS.text, margin: "16px 0 4px", textAlign: "center" }}>
          Where should we begin?
        </h2>
        <p style={{ fontSize: 12, color: V2_NS.muted, margin: "0 0 18px 0", textAlign: "center", lineHeight: 1.5 }}>
          I can plan changes, audit policies, and propose batch actions on your fleet.
        </p>
        <div style={{ display: "grid", gap: 6 }}>
          {[
            "What spend changed in the last 7 days?",
            "Show resources missing cost-center",
            "Hibernate idle dev resources tonight",
            "Why did EC2 spike on Mar 8?",
          ].map((p) => (
            <button key={p} style={{
              border: `1px solid ${V2_NS.border}`, background: V2_NS.surface,
              borderRadius: 10, padding: "10px 12px", fontSize: 12, color: V2_NS.text2,
              textAlign: "left", lineHeight: 1.4, fontFamily: "inherit",
            }}>{p}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "10px 12px 14px", borderTop: `1px solid ${V2_NS.border}` }}>
        <div style={{
          border: `1px solid ${V2_NS.border}`, borderRadius: 12,
          padding: "8px 8px 8px 12px", display: "flex", alignItems: "flex-end", gap: 4,
        }}>
          <textarea placeholder="Ask anything" rows={1} style={{
            flex: 1, border: "none", resize: "none", outline: "none",
            fontFamily: "inherit", fontSize: 13, color: V2_NS.text,
            background: "transparent", padding: "4px 0", maxHeight: 80,
          }} />
          <button style={{
            ...v2IconBtn, width: 28, height: 28,
            background: V2_NS.text, color: "#fff", borderRadius: 14,
          }}>
            <V2Icon name="send" size={14} color="#fff" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// SHELL — composes the three pieces.
// ============================================================
const V2_PAGE_LABELS = {
  inbox: "Inbox",
  usage: "Usage",
  resources: "Resources",
  recommendations: "Recommendations",
  autopilot: "Autopilot",
  "tag-governance": "Tag Governance",
  budgets: "Budgets",
  policies: "Policies",
  ingestion: "Data Ingestion",
  "data-explorer": "Data Explorer",
  settings: "Settings",
};

function NumioShellV2({ children, activePage = "inbox", page, chatCollapsed = false, onToggleChat }) {
  const [chatClosed, setChatClosed] = useStateV2(chatCollapsed);
  const closed = onToggleChat ? chatCollapsed : chatClosed;
  const toggle = onToggleChat || (() => setChatClosed((c) => !c));
  const label = page || V2_PAGE_LABELS[activePage] || "Inbox";

  return (
    <div style={{
      width: "100%", height: "100%", background: V2_NS.bg, color: V2_NS.text,
      display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
      position: "relative",
    }}>
      <NumioTopBarV2 page={label} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <NumioSidebarV2 activePage={activePage} />
        <main style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
          {children}
        </main>
        <NumioChatPanelV2 collapsed={closed} onToggle={toggle} />
      </div>
    </div>
  );
}

Object.assign(window, { V2_NS, NumioShellV2, NumioTopBarV2, NumioSidebarV2, NumioChatPanelV2, V2Icon });
