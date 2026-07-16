// numio-shell.jsx — Faithful recreation of the real Numio app chrome:
//   SlimTopBar  +  OverviewSidebar  +  content  +  ChatPanel (right rail)
//
// Used to wrap each tag-management artboard so the proposal lives inside the
// real product instead of a generic table chrome.
//
// Mirrored from numio-app/frontend/src:
//   components/SlimTopBar.jsx       → top bar
//   components/OverviewSidebar.jsx  → left nav (Tag Governance highlighted)
//   components/ChatPanel.jsx        → right rail
const { useState: useStateNS } = React;

const NS = {
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
  successBg: "#f0fdf4",
  warn: "#d97706",
  warnBg: "#fffbeb",
  danger: "#dc2626",
  dangerBg: "#fef2f2",
};

// ------------------ Lucide-style icons (subset) ------------------
const LIcon = ({ name, size = 16, color = "currentColor", strokeWidth = 1.5, style }) => {
  const p = {
    layoutDashboard: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
    activity:        <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    dollar:          <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    server:          <><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
    zap:             <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    tags:            <><path d="M9 5H2v7l8.5 8.5a2.5 2.5 0 0 0 3.5 0l3.5-3.5a2.5 2.5 0 0 0 0-3.5L9 5z"/><line x1="6" y1="9" x2="6.01" y2="9"/></>,
    shield:          <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    database:        <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/></>,
    settings:        <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    chevronDown:     <><polyline points="6 9 12 15 18 9"/></>,
    panelLeftClose:  <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M16 15l-3-3 3-3"/></>,
    sparkles:        <><path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></>,
    messageSquare:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    sliders:         <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
    sun:             <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    moon:            <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    bell:            <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    bot:             <><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></>,
    plus:            <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    send:            <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    x:               <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {p[name]}
    </svg>
  );
};

// ------------------ NumioMark (logo) ------------------
const NumioMark = ({ size = 18 }) => (
  // simplified — circular mark with "n"
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect width="24" height="24" rx="6" fill="#111827"/>
    <path d="M7 17V9.5c0-.4.4-.7.8-.5l.4.2c.7.4 1.3.3 2-.1.7-.4 1.5-.6 2.4-.6 2.4 0 4.2 1.7 4.2 4.3V17h-2.2v-3.6c0-1.4-.9-2.3-2.1-2.3-1.3 0-2.3 1-2.3 2.4V17H7z" fill="#fff"/>
  </svg>
);

// ============================================================
// TOP BAR (SlimTopBar)
// ============================================================
function NumioTopBar({ page = "Tag Governance" }) {
  return (
    <header style={{
      height: 44, flexShrink: 0,
      borderBottom: `1px solid ${NS.border}`,
      display: "flex", alignItems: "center",
      padding: "0 16px",
      background: NS.surface,
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <NumioMark size={20} />
        <span style={{ fontSize: 15, fontWeight: 600, color: NS.text, letterSpacing: "-0.01em" }}>Numio</span>
        <span style={{ color: "#d1d5db", fontSize: 14 }}>/</span>
        <span style={{ fontSize: 13, color: NS.muted }}>{page}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button style={{
          ...iconBtnStyle, width: 30, height: 30,
          color: NS.ai, borderRadius: 8,
        }} title="Ask Numio (⌘K)">
          <LIcon name="sparkles" size={16} color={NS.ai} strokeWidth={1.75} />
        </button>
        <button style={iconBtnStyle} title="Chat">
          <LIcon name="messageSquare" size={18} color={NS.muted} strokeWidth={1.75} />
        </button>
        <button style={{ ...iconBtnStyle, border: `1px solid ${NS.border}` }} title="Customize">
          <LIcon name="sliders" size={16} color={NS.muted} strokeWidth={1.75} />
        </button>
        <button style={iconBtnStyle} title="Theme">
          <LIcon name="moon" size={18} color={NS.muted} strokeWidth={1.75} />
        </button>
        <button style={{ ...iconBtnStyle, position: "relative" }} title="Notifications">
          <LIcon name="bell" size={18} color={NS.muted} strokeWidth={1.75} />
          <span style={{
            position: "absolute", top: 4, right: 4,
            minWidth: 14, height: 14, borderRadius: 7,
            background: "#ef4444", color: "#fff",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
          }}>3</span>
        </button>
        <div style={{ width: 1, height: 18, background: NS.border, margin: "0 4px" }} />
        <span style={{
          fontSize: 11, color: NS.muted, padding: "3px 8px",
          border: `1px solid ${NS.border}`, borderRadius: 999,
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: NS.success }} /> Synced 2m
        </span>
        <span style={{
          fontSize: 11, color: NS.text2, padding: "3px 8px",
          border: `1px solid ${NS.border}`, borderRadius: 999, background: "#fafafa",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <LIcon name="bot" size={11} color={NS.success} strokeWidth={2} />
          Autopilot · Active
        </span>
      </div>
    </header>
  );
}

const iconBtnStyle = {
  width: 32, height: 32,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none", borderRadius: 8, cursor: "pointer",
  padding: 0,
};

// ============================================================
// LEFT NAV (OverviewSidebar)
// ============================================================
const NAV = [
  [
    { id: "overview",  label: "Overview", icon: "layoutDashboard" },
    { id: "ingestion", label: "Data Ingestion", icon: "activity" },
  ],
  [
    { id: "usage-cost", label: "Usage & Cost", icon: "dollar", children: [
      { id: "cloud-usage", label: "Cloud Usage" },
      { id: "ai-usage", label: "AI Usage" },
      { id: "alerts", label: "Alerts" },
    ]},
    { id: "resources", label: "Resources", icon: "server" },
  ],
  [
    { id: "optimize", label: "Optimize", icon: "zap", children: [
      { id: "zombie", label: "Zombie Hunter" },
      { id: "opt-services", label: "Services" },
      { id: "opt-ai", label: "AI Workloads" },
      { id: "opt-k8s", label: "Kubernetes" },
    ]},
  ],
  [
    { id: "tag-governance", label: "Tag Governance", icon: "tags" },
    { id: "configure", label: "Configure", icon: "shield", children: [
      { id: "cfg-budgets", label: "Team Budgets" },
      { id: "cfg-tags", label: "Tags" },
      { id: "cfg-policies", label: "Policies" },
    ]},
  ],
  [
    { id: "data-explorer", label: "Data Explorer", icon: "database" },
    { id: "settings", label: "Settings", icon: "settings" },
  ],
];

function NumioSidebar({ activePage = "tag-governance" }) {
  // Auto-expand the parent of the active page on first render.
  const initialExpand = { "usage-cost": false, "optimize": false, "configure": false };
  for (const section of NAV) {
    for (const item of section) {
      if (item.children?.some(c => c.id === activePage)) initialExpand[item.id] = true;
    }
  }
  const [expanded, setExpanded] = useStateNS(initialExpand);

  return (
    <aside style={{
      width: 220, flexShrink: 0, borderRight: `1px solid ${NS.border}`,
      background: NS.surface, display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
        <nav>
          {/* Toggle row */}
          <div style={{ display: "flex", paddingLeft: 12, paddingRight: 12, marginBottom: 8 }}>
            <button style={{ ...iconBtnStyle, width: 28, height: 28, color: NS.xMuted }}>
              <LIcon name="panelLeftClose" size={20} color={NS.xMuted} />
            </button>
          </div>

          {NAV.map((section, si) => (
            <React.Fragment key={si}>
              {si > 0 && <div style={{ height: 1, background: NS.border, margin: "8px 12px" }} />}
              {section.map(item => {
                const isExp = expanded[item.id];
                const hasKids = item.children?.length > 0;
                const isActive = item.id === activePage ||
                  (hasKids && item.children.some(c => c.id === activePage));
                const isLeafActive = item.id === activePage && !hasKids;
                return (
                  <div key={item.id}>
                    <div
                      onClick={() => hasKids && setExpanded(s => ({ ...s, [item.id]: !s[item.id] }))}
                      style={{
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "7px 12px",
                        borderRadius: 8, cursor: "pointer",
                        background: isLeafActive ? "#f3f4f6" : "transparent",
                        color: isActive ? NS.text : NS.text2,
                        fontWeight: isActive ? 500 : 400,
                        margin: "1px 4px",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <LIcon name={item.icon} size={16} color={isActive ? NS.text : NS.text2} strokeWidth={1.5} />
                        <span style={{ fontSize: 13 }}>{item.label}</span>
                      </div>
                      {hasKids && (
                        <LIcon name="chevronDown" size={14} color={NS.xMuted}
                          style={{ transform: isExp ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 200ms" }} />
                      )}
                    </div>
                    {hasKids && isExp && (
                      <div style={{ marginLeft: 20, paddingLeft: 14, marginBottom: 4, borderLeft: `1px solid #f0f0f0` }}>
                        {item.children.map(c => {
                          const childActive = c.id === activePage;
                          return (
                            <div key={c.id} style={{
                              padding: "6px 10px", borderRadius: 6, fontSize: 12,
                              color: childActive ? NS.text : NS.muted,
                              fontWeight: childActive ? 500 : 400,
                              background: childActive ? "#f3f4f6" : "transparent",
                              cursor: "pointer",
                            }}>{c.label}</div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Footer profile */}
      <div style={{
        flexShrink: 0, borderTop: "1px solid #f0f0f0", padding: 12,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 16, background: NS.text, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>JC</div>
        <div style={{ overflow: "hidden", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: NS.text }}>James C.</div>
          <div style={{ fontSize: 11, color: NS.xMuted }}>Admin</div>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// RIGHT — CHAT PANEL (Numio Assistant)
// ============================================================
function NumioChatPanel({ collapsed, onToggle, conversation = "default" }) {
  if (collapsed) {
    return (
      <button onClick={onToggle} style={{
        position: "absolute", bottom: 20, right: 20, zIndex: 10,
        background: NS.surface, border: `1px solid ${NS.border}`,
        borderRadius: 9999, padding: "8px 14px",
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: "Inter, system-ui, sans-serif", fontSize: 13,
        color: NS.text, cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}>
        <LIcon name="sparkles" size={14} color={NS.ai} strokeWidth={1.75} />
        <span>Ask Numio</span>
        <span style={{ color: NS.xMuted }}>↗</span>
      </button>
    );
  }
  return (
    <aside style={{
      width: 360, flexShrink: 0, borderLeft: `1px solid ${NS.border}`,
      background: NS.surface, display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${NS.border}` }}>
        <button style={{ ...iconBtnStyle, width: 28, height: 28, color: NS.muted }} title="New">
          <LIcon name="plus" size={16} color={NS.muted} strokeWidth={2} />
        </button>
        <button style={{ background: "none", border: "none", color: NS.muted, fontSize: 12, cursor: "pointer", marginLeft: 4 }}>
          History
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onToggle} style={{ ...iconBtnStyle, width: 28, height: 28, color: NS.muted }}>
          <LIcon name="x" size={16} color={NS.muted} />
        </button>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 8px" }}>
        {conversation === "default" ? (
          <DefaultChatContent />
        ) : (
          <TagChatConversation />
        )}
      </div>

      {/* composer */}
      <div style={{ padding: "10px 12px 14px", borderTop: `1px solid ${NS.border}` }}>
        <div style={{
          border: `1px solid ${NS.border}`, borderRadius: 12,
          padding: "8px 8px 8px 12px", display: "flex", alignItems: "flex-end", gap: 4,
        }}>
          <textarea
            placeholder="Ask anything"
            rows={1}
            style={{
              flex: 1, border: "none", resize: "none", outline: "none",
              fontFamily: "inherit", fontSize: 13, color: NS.text,
              background: "transparent", padding: "4px 0", maxHeight: 80,
            }}
          />
          <button style={{
            ...iconBtnStyle, width: 28, height: 28,
            background: NS.text, color: "#fff", borderRadius: 14,
          }}>
            <LIcon name="send" size={14} color="#fff" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function DefaultChatContent() {
  const prompts = [
    "Tag everything in team:ml with cost-center:CC-ML",
    "Show me untagged resources over $100/mo",
    "Propose owners for resources missing one",
    "Why is dev-worker-02 flagged?",
  ];
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 500, color: NS.text, margin: "16px 0 4px", textAlign: "center" }}>
        Where should we begin?
      </h2>
      <p style={{ fontSize: 12, color: NS.muted, margin: "0 0 18px 0", textAlign: "center", lineHeight: 1.5 }}>
        I can plan tag changes, audit policies, and propose batch actions on your fleet.
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        {prompts.map(p => (
          <button key={p} style={{
            border: `1px solid ${NS.border}`, background: NS.surface,
            borderRadius: 10, padding: "10px 12px", fontSize: 12, color: NS.text2,
            cursor: "pointer", textAlign: "left", lineHeight: 1.4, fontFamily: "inherit",
          }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

function TagChatConversation() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ChatBubble role="user">What's missing on my production resources?</ChatBubble>
      <ChatBubble role="assistant">
        I scanned 9 production resources you own. Coverage is <b style={{ color: NS.success }}>89%</b>.
        Two patterns stand out:
        <div style={{ marginTop: 8, padding: "8px 10px", background: "#f9fafb", borderRadius: 8, border: `1px solid ${NS.border}` }}>
          <div style={{ fontSize: 11.5, color: NS.text2, lineHeight: 1.6 }}>
            <b style={{ color: NS.danger }}>6</b> required-tag gaps · missing <code style={inlineCode}>cost-center</code><br/>
            <b style={{ color: NS.warn }}>1</b> drift · <code style={inlineCode}>env:prod</code> should be <code style={inlineCode}>production</code>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11.5, color: NS.text2 }}>
          I've highlighted them in the heatmap. Want me to apply the fixes?
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={chatBtnPrimary}>Apply fixes (7)</button>
          <button style={chatBtnGhost}>Refine</button>
        </div>
      </ChatBubble>
      <ChatBubble role="user">Just the cost-center ones for now.</ChatBubble>
      <ChatBubble role="assistant">
        Proposed: set <code style={inlineCode}>cost-center:CC-ENG</code> on 4 EC2 instances + 2 Lambdas. All owned by you, all in team:engineering.
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={chatBtnPrimary}>Preview diff</button>
          <button style={chatBtnGhost}>Apply now</button>
        </div>
      </ChatBubble>
    </div>
  );
}

function ChatBubble({ role, children }) {
  const isUser = role === "user";
  return (
    <div style={{
      alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "92%",
      background: isUser ? "#f3f4f6" : "transparent",
      color: NS.text, fontSize: 12.5, lineHeight: 1.5,
      padding: isUser ? "8px 12px" : "0 0 0 4px",
      borderRadius: 14,
      whiteSpace: "pre-wrap",
    }}>{children}</div>
  );
}

const inlineCode = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11,
  background: NS.aiBg, color: NS.ai2, padding: "1px 5px", borderRadius: 4,
};
const chatBtnPrimary = {
  background: NS.text, color: "#fff", border: "none", borderRadius: 6,
  padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};
const chatBtnGhost = {
  background: "transparent", color: NS.muted, border: `1px solid ${NS.border}`,
  borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};

// ============================================================
// MAIN SHELL — composes top bar + sidebar + content + chat rail
// ============================================================
// Lookup: nav id → breadcrumb label.
const PAGE_LABELS = {
  overview: "Dashboard",
  ingestion: "Data Ingestion",
  "cloud-usage": "Cloud Usage",
  "ai-usage": "AI Usage",
  alerts: "Feed",
  feed: "Feed",
  resources: "Resources",
  zombie: "Zombie Hunter",
  "opt-services": "Services",
  "opt-ai": "AI Workloads",
  "opt-k8s": "Kubernetes",
  "tag-governance": "Tag Governance",
  "cfg-budgets": "Team Budgets",
  "cfg-tags": "Tags",
  "cfg-policies": "Policies",
  "data-explorer": "Data Explorer",
  settings: "Settings",
};

function NumioShell({ children, activePage = "tag-governance", page, chatCollapsed = false, chatConversation = "default", onToggleChat }) {
  const pageLabel = page || PAGE_LABELS[activePage] || "Dashboard";
  const [chatClosed, setChatClosed] = useStateNS(chatCollapsed);
  const closed = onToggleChat ? chatCollapsed : chatClosed;
  const toggle = onToggleChat || (() => setChatClosed(c => !c));

  return (
    <div style={{
      width: "100%", height: "100%", background: NS.bg, color: NS.text,
      display: "flex", flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
      position: "relative",
    }}>
      <NumioTopBar page={pageLabel} />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <NumioSidebar activePage={activePage} />
        <main style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
          {children}
        </main>
        <NumioChatPanel collapsed={closed} onToggle={toggle} conversation={chatConversation} />
      </div>
    </div>
  );
}

Object.assign(window, { NS, NumioShell, NumioTopBar, NumioSidebar, NumioChatPanel, LIcon });
