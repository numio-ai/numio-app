import React from "react";
import { getSavedTimeZone, resolveTimeZone, saveTimeZonePreference } from "../../utils/timezone";
import { accountOwner } from "../../mocks/mockPeople";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

export default function Profile() {
  const [name, setName] = React.useState(accountOwner.name);
  const savedTimeZone = getSavedTimeZone();
  const [tzMode, setTzMode] = React.useState(savedTimeZone.mode || "auto");
  const [manualZone, setManualZone] = React.useState(savedTimeZone.zone || "America/Los_Angeles");
  const currentZone = resolveTimeZone(tzMode, manualZone);

  const handleTimeZoneSave = () => {
    saveTimeZonePreference(tzMode, manualZone);
  };

  return (
    <div className="pageContent settings-page-content">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Profile</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
              Account owner profile and preferences.
            </p>
          </div>
        </div>

        {/* Account owner — Overview style */}
        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          title={`Account owner: ${accountOwner.name} (${accountOwner.email})`}
        >
          <p className={execHeaderClass}>ACCOUNT OWNER</p>
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {accountOwner.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-semibold" style={{ color: "var(--text)" }}>{accountOwner.name}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-emerald-600 bg-emerald-50">Owner</span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{accountOwner.email}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{accountOwner.role} · {accountOwner.lastActive}</p>
            </div>
          </div>
        </section>

        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>PROFILE DETAILS</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Set a full name or a preferred display name.
          </p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.05em] block mb-2" style={{ color: "var(--text-tertiary)" }}>Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button className="btn btn--primary">Save</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.05em] block mb-2" style={{ color: "var(--text-tertiary)" }}>Email Address</label>
              <input
                type="email"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-tertiary)", background: "var(--bg-inset)" }}
                value={accountOwner.email}
                disabled
              />
              <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                Email is managed by your identity provider.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.05em] block mb-2" style={{ color: "var(--text-tertiary)" }}>Password</label>
              <input
                type="password"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                Change your password. Use a strong password for security.
              </p>
              <button className="btn btn--primary mt-2">Change password</button>
            </div>
          </div>
        </section>

        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>TIME ZONE</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Choose automatic detection or manually set a time zone for greeting accuracy.
          </p>
          <div className="flex flex-wrap gap-2">
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}
                value={tzMode}
                onChange={(e) => setTzMode(e.target.value)}
              >
                <option value="auto">Automatic (use browser time zone)</option>
                <option value="manual">Manual</option>
              </select>
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}
                value={manualZone}
                onChange={(e) => setManualZone(e.target.value)}
                disabled={tzMode !== "manual"}
              >
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
              <button className="btn btn--primary" type="button" onClick={handleTimeZoneSave}>
                Save
              </button>
            </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
            Current time zone: {currentZone}
          </p>
        </section>

        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>DEFAULT DASHBOARD</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Choose a default dashboard for when visiting console.numio.ai.
          </p>
          <div className="flex gap-2">
              <select
                className="rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--bg)" }}
              >
                <option value="">No dashboard selected</option>
                <option value="overview">Overview</option>
              </select>
              <button className="btn btn--primary">Save</button>
          </div>
        </section>
    </div>
  );
}
