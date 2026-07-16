import React from "react";
import {
  alertRoutingRules,
  quietHours,
  digestSettings,
  alertSuppressions,
  lastUpdated,
} from "../../mocks/mockNotifications";

/* Overview-style design tokens */
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

const priorityBadgeClass = (priority) => {
  switch (priority) {
    case "critical":
      return "badge-priority-critical";
    case "warning":
      return "badge-priority-warning";
    default:
      return "badge-priority-info";
  }
};

export default function Notifications() {
  const rulesCount = alertRoutingRules.length;
  const suppressionsCount = alertSuppressions.length;

  return (
    <div className="pageContent settings-page-content">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>
              Notifications
            </h1>
            <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
              Route alerts by severity and type. Budget and anomaly alerts feed from Overview.
            </p>
          </div>
        </div>

        {/* Compact summary bar */}
        <section
          className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white"
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0" style={{ color: "var(--text-tertiary)" }}>
            ALERT ROUTING
          </p>
          <p className="text-2xl font-semibold tracking-tight shrink-0" style={{ color: "var(--text)" }}>
            {rulesCount} rules
          </p>
          {suppressionsCount > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium text-amber-600 bg-amber-50">
              {suppressionsCount} suppression{suppressionsCount !== 1 ? "s" : ""} active
            </span>
          )}
          <span className="text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
            Updated {lastUpdated}
          </span>
        </section>

        {/* Alert Routing Rules */}
        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <div className="flex justify-between items-center mb-3">
            <p className={execHeaderClass} style={{ marginBottom: 0 }}>ALERT ROUTING RULES</p>
            <button className="btn btn--primary btn--sm">+ Add Routing Rule</button>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Control where budget overruns, anomalies, and idle resource alerts are sent.
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="table table--compact w-full">
              <thead>
                <tr>
                  <th className="th th--left" style={{ borderColor: "var(--border)" }}>Alert Type</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Recipients</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Channels</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Priority</th>
                  <th className="th th--actions" style={{ borderColor: "var(--border)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alertRoutingRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{rule.alertType}</td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{rule.recipients}</td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{rule.channels.join(", ")}</td>
                    <td className="td" style={{ borderColor: "var(--border)" }}>
                      <span className={`badge-priority ${priorityBadgeClass(rule.priority)}`}>
                        {rule.priority}
                      </span>
                    </td>
                    <td className="td td--actions" style={{ borderColor: "var(--border)" }}>
                      <button className="btn btn--outline btn--sm">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quiet Hours */}
          <section
            className={execCardClass}
            style={{ marginBottom: 0, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className={execHeaderClass}>QUIET HOURS</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Send alerts outside quiet hours only
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text)" }}>Enabled</span>
                <label className="toggleRow">
                  <input type="checkbox" className="toggle__input" defaultChecked={quietHours.enabled} />
                  <span className="toggle toggle--small">
                    <span className="toggle__knob"></span>
                  </span>
                </label>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Schedule</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="formInput formInput--small"
                    defaultValue={quietHours.start}
                    style={{ borderColor: "var(--border)" }}
                  />
                  <span style={{ color: "var(--text-tertiary)" }}>to</span>
                  <input
                    type="time"
                    className="formInput formInput--small"
                    defaultValue={quietHours.end}
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Timezone</label>
                <select className="formSelect formSelect--small w-full" style={{ borderColor: "var(--border)" }}>
                  <option>{quietHours.timezone}</option>
                  <option>Mountain Time (MT)</option>
                  <option>Central Time (CT)</option>
                  <option>Eastern Time (ET)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Digest Mode */}
          <section
            className={execCardClass}
            style={{ marginBottom: 0, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className={execHeaderClass}>DIGEST MODE</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Daily summary at {digestSettings.time}
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--text)" }}>Daily Digest</span>
                <label className="toggleRow">
                  <input type="checkbox" className="toggle__input" defaultChecked={digestSettings.enabled} />
                  <span className="toggle toggle--small">
                    <span className="toggle__knob"></span>
                  </span>
                </label>
              </div>
              <div>
                <label className="text-xs block mb-2" style={{ color: "var(--text-tertiary)" }}>Include</label>
                <div className="space-y-2">
                  {[
                    { key: "budgetStatus", label: "Budget status", checked: digestSettings.include.budgetStatus },
                    { key: "idleResources", label: "Idle resources", checked: digestSettings.include.idleResources },
                    { key: "recommendations", label: "Recommendations", checked: digestSettings.include.recommendations },
                    { key: "policyViolations", label: "Policy violations", checked: digestSettings.include.policyViolations },
                  ].map(({ key, label, checked }) => (
                    <label key={key} className="checkboxRow flex items-center gap-2">
                      <input type="checkbox" defaultChecked={checked} />
                      <span className="text-sm" style={{ color: "var(--text)" }}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Alert Suppression */}
        <section
          className={execCardClass}
          style={{ marginTop: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <div className="flex justify-between items-center mb-3">
            <p className={execHeaderClass} style={{ marginBottom: 0 }}>ALERT SUPPRESSION</p>
            <button className="btn btn--outline btn--sm">+ Suppress Alerts</button>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Temporarily mute alerts for specific resources
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="table table--compact w-full">
              <thead>
                <tr>
                  <th className="th th--left" style={{ borderColor: "var(--border)" }}>Resource</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Reason</th>
                  <th className="th" style={{ borderColor: "var(--border)" }}>Until</th>
                  <th className="th th--actions" style={{ borderColor: "var(--border)" }}></th>
                </tr>
              </thead>
              <tbody>
                {alertSuppressions.map((sup) => (
                  <tr key={sup.id}>
                    <td className="td td--left" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{sup.resource}</td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{sup.reason}</td>
                    <td className="td" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{sup.until}</td>
                    <td className="td td--actions" style={{ borderColor: "var(--border)" }}>
                      <button className="btn btn--ghost btn--sm">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}
