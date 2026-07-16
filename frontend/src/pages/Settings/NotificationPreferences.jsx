import React, { useEffect, useState } from "react";
import { getNotificationPreferences, updateNotificationPreferences } from "../../api/workspace";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

const EVENT_TYPES = [
  { key: "budget_alert", label: "Budget Alerts", description: "Notifications when budgets are exceeded or approaching limits" },
  { key: "anomaly_detected", label: "Anomaly Detection", description: "Cost anomalies and unexpected spending patterns" },
  { key: "zombie_found", label: "Zombie Resources", description: "Idle or unattached resources detected" },
  { key: "policy_violation", label: "Policy Violations", description: "Infrastructure or tag policy violations" },
  { key: "recommendation_generated", label: "Recommendations", description: "New cost optimization recommendations" },
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getNotificationPreferences()
      .then((data) => {
        const map = {};
        (data.preferences || []).forEach((p) => { map[p.event_type] = p.enabled; });
        setPrefs(map);
      })
      .catch((e) => {
        // Preferences may not exist yet — default all to enabled
        const defaults = {};
        EVENT_TYPES.forEach((et) => { defaults[et.key] = true; });
        setPrefs(defaults);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (eventType) => {
    const newEnabled = !prefs[eventType];
    const newPrefs = { ...prefs, [eventType]: newEnabled };
    setPrefs(newPrefs);

    setSaving(true);
    try {
      await updateNotificationPreferences([{ event_type: eventType, enabled: newEnabled }]);
    } catch (e) {
      setError(e.message);
      // Revert on error
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-tertiary)" }}>Loading notification preferences...</div>;
  }

  return (
    <div className="pageContent settings-page-content">
      <div className="mb-6">
        <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Notifications</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Choose which notification types you want to receive.
        </p>
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{error}</p>}

      <section
        className={execCardClass}
        style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
      >
        <p className={execHeaderClass}>EVENT TYPES</p>
        <div className="space-y-1">
          {EVENT_TYPES.map((et) => {
            const enabled = prefs[et.key] !== false;
            return (
              <div
                key={et.key}
                className="flex items-center justify-between py-3 border-b last:border-b-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{et.label}</span>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)", marginTop: 2 }}>{et.description}</p>
                </div>
                <button
                  className={`btn btn--sm ${enabled ? "btn--outline" : "btn--primary"}`}
                  onClick={() => handleToggle(et.key)}
                  disabled={saving}
                  style={{ minWidth: 80 }}
                >
                  {enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
