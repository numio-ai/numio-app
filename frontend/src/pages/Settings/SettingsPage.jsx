import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Workspaces from "./Workspaces";
import People from "./People";
import BillingPlans from "./BillingPlans";
import Integrations from "./Integrations";
import APIAccessTokens from "./APIAccessTokens";
import NotificationPreferences from "./NotificationPreferences";
import AutomationSafety from "./AutomationSafety";
import AuditLogs from "./AuditLogs";

const TABS = [
  { id: "workspaces", label: "Workspace" },
  { id: "integrations", label: "Integrations" },
  { id: "people", label: "People" },
  { id: "access_tokens", label: "API Access Tokens" },
  { id: "notifications", label: "Notifications" },
  { id: "automation-safety", label: "Automation Safety" },
  { id: "audit_logs", label: "Audit Logs" },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "workspaces";
  const activeTab = useMemo(() => {
    const found = TABS.find((t) => t.id === tab);
    return found ? found.id : "workspaces";
  }, [tab]);

  const setTab = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    });
  };

  return (
    <div className="pageContent settings-page-content" style={{ padding: "24px 24px 0" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>
          Workspace, billing, integrations, and audit
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: activeTab === t.id ? 600 : 400,
              borderRadius: 6,
              border: `1px solid ${activeTab === t.id ? "var(--text-primary)" : "var(--border)"}`,
              background: activeTab === t.id ? "var(--text-primary)" : "var(--card)",
              color: activeTab === t.id ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 120ms ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ minHeight: 400 }}>
        {activeTab === "workspaces" && <Workspaces />}
        {activeTab === "integrations" && <Integrations />}
        {activeTab === "people" && <People />}
        {activeTab === "access_tokens" && <APIAccessTokens />}
        {activeTab === "notifications" && <NotificationPreferences />}
        {activeTab === "automation-safety" && <AutomationSafety />}
        {activeTab === "audit_logs" && <AuditLogs />}
      </div>
    </div>
  );
}
