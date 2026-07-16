import React, { useEffect, useState } from "react";
import { getAutomationStatus, setGlobalToggle, setDomainToggle } from "../../api/workspace";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

const DOMAINS = [
  { key: "budget_alerts", label: "Budget Alerts" },
  { key: "anomaly_detection", label: "Anomaly Detection" },
  { key: "zombie_detection", label: "Zombie Detection" },
  { key: "policy_evaluation", label: "Policy Evaluation" },
  { key: "recommendations", label: "Recommendations" },
];

export default function AutomationSafety() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStatus = async () => {
    try {
      const data = await getAutomationStatus();
      setStatus(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleGlobalToggle = async () => {
    try {
      const data = await setGlobalToggle(!status.automation_paused);
      setStatus(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDomainToggle = async (domain, currentPaused) => {
    try {
      const data = await setDomainToggle(domain, !currentPaused);
      setStatus(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const getDomainPaused = (domain) => {
    const toggle = status?.domain_toggles?.find((t) => t.domain === domain);
    return toggle?.paused || false;
  };

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-tertiary)" }}>Loading automation status...</div>;
  }

  const pausedCount = DOMAINS.filter((d) => getDomainPaused(d.key)).length;
  const activeCount = DOMAINS.length - pausedCount;

  return (
    <div className="pageContent settings-page-content">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Automation Safety</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Andon cord — pause automated notifications globally or by domain.
          </p>
        </div>
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{error}</p>}

      {/* Summary bar */}
      <section
        className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border bg-white"
        style={{ marginBottom: 24, borderColor: "var(--border)", borderRadius: "var(--radius-lg)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0" style={{ color: "var(--text-tertiary)" }}>
          AUTOMATION STATUS
        </p>
        <p className="text-2xl font-semibold tracking-tight shrink-0" style={{ color: "var(--text)" }}>
          {status?.automation_paused ? "ALL PAUSED" : `${activeCount} active · ${pausedCount} paused`}
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global toggle */}
        <section
          className={execCardClass}
          style={{
            borderColor: status?.automation_paused ? "var(--danger)" : "var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--card-padding)",
          }}
        >
          <p className={execHeaderClass}>GLOBAL AUTOMATION PAUSE</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            When paused, all automated notifications are suppressed across all domains.
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: status?.automation_paused ? "var(--danger)" : "var(--success, #059669)" }}>
              {status?.automation_paused ? "All Automation Paused" : "Automation Active"}
            </span>
            <button
              className={`btn btn--sm ${status?.automation_paused ? "btn--primary" : "btn--danger"}`}
              onClick={handleGlobalToggle}
            >
              {status?.automation_paused ? "Resume All" : "Pause All"}
            </button>
          </div>
        </section>

        {/* Per-domain toggles */}
        <section
          className={execCardClass}
          style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>DOMAIN TOGGLES</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Pause or resume automation by domain independently.
          </p>
          <div className="space-y-3">
            {DOMAINS.map((d) => {
              const paused = getDomainPaused(d.key);
              return (
                <div key={d.key} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm" style={{ color: "var(--text)" }}>{d.label}</span>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{
                        background: paused ? "var(--bg-inset)" : "var(--success-bg, #ecfdf5)",
                        color: paused ? "var(--text-tertiary)" : "var(--success, #059669)",
                      }}
                    >
                      {paused ? "Paused" : "Active"}
                    </span>
                    <button
                      className="btn btn--outline btn--sm"
                      onClick={() => handleDomainToggle(d.key, paused)}
                      style={{ minWidth: 70 }}
                    >
                      {paused ? "Resume" : "Pause"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
