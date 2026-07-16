import React, { useState } from "react";
import AuditEventTable from "../../components/AuditEventTable";
import AuditActionEventTable from "../../components/AuditActionEventTable";

const TABS = [
  { id: "setup", label: "Setup" },
  { id: "operations", label: "Operations" },
];

export default function GovernAuditLog() {
  const [activeTab, setActiveTab] = useState("setup");

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>Audit Log</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
          Searchable audit trail. <strong>Setup</strong> covers configuration changes; <strong>Operations</strong> covers actions Numio performed against external systems.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              borderRadius: 6,
              border: `1px solid ${activeTab === tab.id ? "#111827" : "#e5e5e5"}`,
              background: activeTab === tab.id ? "#111827" : "#fff",
              color: activeTab === tab.id ? "#fff" : "#6b7280",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 120ms ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "setup" ? <AuditEventTable /> : <AuditActionEventTable />}
    </div>
  );
}
