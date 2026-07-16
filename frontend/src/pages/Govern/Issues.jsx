import React from "react";
import { issueSummary, issueTickets, lastUpdated } from "../../mocks/mockIssues";
import StatusBadge from "../../components/StatusBadge";
const ticketingTools = ["Jira", "Linear", "ServiceNow", "GitHub Issues"];

export default function GovernIssues() {
  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>Govern</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
          Tickets created by Numio across policy, budget, and anomaly events. Aligned with Overview.
        </p>
      </div>

        {/* Compact summary bar */}
        <section
          className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white"
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0" style={{ color: "var(--text-tertiary)" }}>
            TICKETS
          </p>
          <p className="text-2xl font-semibold tracking-tight shrink-0" style={{ color: "var(--text)" }}>
            {issueSummary.open} open
          </p>
          <span className="shrink-0 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {issueSummary.routed} routed · {issueSummary.resolved} resolved
          </span>
          {issueSummary.open > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium text-amber-600 bg-amber-50">
              {issueSummary.open} need attention
            </span>
          )}
          <span className="text-xs shrink-0 ml-auto" style={{ color: "var(--text-tertiary)" }}>
            Updated {lastUpdated}
          </span>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Ticket summary */}
          <section
            className="card"
            style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className="card-label">TICKET SUMMARY</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{issueSummary.open}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Open</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{issueSummary.routed}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Routed</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: "var(--text)" }}>{issueSummary.resolved}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Resolved</p>
              </div>
            </div>
          </section>

          {/* Integration status */}
          <section
            className="card"
            style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className="card-label">INTEGRATION STATUS</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Ticketing tools connected for auto-creation and routing
            </p>
            <div className="space-y-2">
              {ticketingTools.map((tool) => (
                <div
                  key={tool}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-sm" style={{ color: "var(--text)" }}>{tool}</span>
                  <StatusBadge status="Connected" />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Open tickets table */}
        <section
          className="card"
          style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className="card-label">OPEN TICKETS</p>
          <div className="overflow-x-auto -mx-1">
            <table className="table table--compact w-full">
              <thead>
                <tr>
                  <th className="th th--left" style={{ borderColor: "var(--border)" }}>Ticket</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Type</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Owner</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Status</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {issueTickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="td td--empty" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
                      No open tickets.
                    </td>
                  </tr>
                ) : (
                  issueTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                        {ticket.title}
                      </td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{ticket.type}</td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{ticket.owner}</td>
                      <td className="td" style={{ borderColor: "var(--border)" }}>
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>{ticket.created}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
