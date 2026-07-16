import React, { useEffect, useState } from "react";
import { getWorkspaceSettings, updateWorkspaceSettings } from "../../api/workspace";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

export default function Workspaces() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: "", default_currency: "", timezone: "", data_retention_days: 365 });

  useEffect(() => {
    getWorkspaceSettings()
      .then((data) => {
        setSettings(data);
        setForm({
          name: data.name,
          default_currency: data.default_currency,
          timezone: data.timezone,
          data_retention_days: data.data_retention_days,
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWorkspaceSettings(form);
      setSettings(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "var(--text-tertiary)" }}>Loading workspace settings...</div>;
  }

  if (error && !settings) {
    return <div style={{ padding: 24, color: "var(--danger)" }}>Error: {error}</div>;
  }

  return (
    <div className="pageContent settings-page-content">
      <section
        className={execCardClass}
        style={{ marginBottom: 24, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
      >
        <p className={execHeaderClass}>WORKSPACE SETTINGS</p>
        {error && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{error}</p>}
        <div className="space-y-4">
          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Workspace Name</label>
            <input
              className="formInput formInput--small w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Default Currency</label>
              <select
                className="formInput formInput--small w-full"
                value={form.default_currency}
                onChange={(e) => setForm({ ...form, default_currency: e.target.value })}
                style={{ borderColor: "var(--border)" }}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Timezone</label>
              <select
                className="formInput formInput--small w-full"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                style={{ borderColor: "var(--border)" }}
              >
                <option value="UTC">UTC</option>
                <option value="US/Eastern">US/Eastern</option>
                <option value="US/Central">US/Central</option>
                <option value="US/Mountain">US/Mountain</option>
                <option value="US/Pacific">US/Pacific</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Data Retention (days)</label>
              <input
                type="number"
                className="formInput formInput--small w-full"
                value={form.data_retention_days}
                min={30}
                max={3650}
                onChange={(e) => setForm({ ...form, data_retention_days: parseInt(e.target.value, 10) || 365 })}
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </section>

      <section
        className={execCardClass}
        style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
      >
        <p className={execHeaderClass}>WORKSPACE INFO</p>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Workspace ID</span>
            <code className="text-sm px-2 py-1 rounded" style={{ background: "var(--bg-inset)", color: "var(--text)", border: "1px solid var(--border)" }}>
              {settings?.id?.substring(0, 8)}...
            </code>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Slug</span>
            <code className="text-sm px-2 py-1 rounded" style={{ background: "var(--bg-inset)", color: "var(--text)", border: "1px solid var(--border)" }}>
              {settings?.slug}
            </code>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>Created</span>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {settings?.created_at ? new Date(settings.created_at).toLocaleDateString() : "—"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
