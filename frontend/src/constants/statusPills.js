/**
 * Shared state configurations for top-bar StatusPill instances.
 *
 * Keep configs here so Autopilot and Data pills stay visually parallel
 * and color vocabulary is consistent across the app shell.
 *
 * Color palette matches existing semantic tokens used in StatusBadge.jsx
 * and the Integrations page (connected/incomplete/disconnected/inactive).
 */

export const AUTOPILOT_PILL_STATES = {
  active: {
    label: "Active",
    dotColor: "#16a34a",
    background: "#f0fdf4",
    textColor: "#15803d",
  },
  paused: {
    label: "Paused",
    dotColor: "#d97706",
    background: "#fffbeb",
    textColor: "#b45309",
  },
  disabled: {
    label: "Disabled",
    dotColor: "#dc2626",
    background: "#fef2f2",
    textColor: "#b91c1c",
  },
};

/**
 * Data (ingestion) pill state vocabulary, retained for reference and
 * for any non-shell consumer that surfaces a Data-only status.
 */
export const DATA_PILL_STATES = {
  synced: {
    label: "Synced",
    dotColor: "#16a34a",
    background: "#f0fdf4",
    textColor: "#15803d",
  },
  syncing: {
    label: "Syncing",
    dotColor: "#0284c7",
    background: "#eff6ff",
    textColor: "#0369a1",
  },
  delayed: {
    label: "Delayed",
    dotColor: "#d97706",
    background: "#fffbeb",
    textColor: "#b45309",
  },
  issue: {
    label: "Issue",
    dotColor: "#dc2626",
    background: "#fef2f2",
    textColor: "#b91c1c",
  },
  not_configured: {
    label: "Not configured",
    dotColor: "#9ca3af",
    background: "#f3f4f6",
    textColor: "#4b5563",
  },
};
