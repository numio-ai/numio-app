import React from "react";
import AuditEventTable from "../../components/AuditEventTable";

export default function AuditLogs() {
  return (
    <div className="pageContent settings-page-content">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>Audit Logs</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            Track all changes and actions across your workspace.
          </p>
        </div>
      </div>
      <AuditEventTable compact />
    </div>
  );
}
