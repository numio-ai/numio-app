import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, AlertTriangle } from "lucide-react";
import { useIngestionStatus } from "../context/IngestionStatusContext";
import {
  deriveDataPillState,
  mostRecentFailure,
} from "../lib/ingestionStatus";
import useAutopilotStatus from "../hooks/useAutopilotStatus";

const SIGNAL = {
  ok: { dotColor: "#16a34a", label: "OK" },
  degraded: { dotColor: "#d97706", label: "Degraded" },
  failed: { dotColor: "#dc2626", label: "Issue" },
};

const DATA_SIGNAL_BY_STATE = {
  synced: "ok",
  syncing: "ok",
  delayed: "degraded",
  not_configured: "degraded",
  issue: "failed",
};

const AUTOPILOT_SIGNAL_BY_STATE = {
  active: "ok",
  disabled: "ok",
  paused: "degraded",
};

const DATA_LABEL_BY_STATE = {
  synced: "Synced",
  syncing: "Syncing",
  delayed: "Delayed",
  not_configured: "Not configured",
  issue: "Issue",
};

const AUTOPILOT_LABEL_BY_STATE = {
  active: "Active",
  disabled: "Disabled",
  paused: "Paused",
};

function aggregateSignal(...signals) {
  if (signals.includes("failed")) return "failed";
  if (signals.includes("degraded")) return "degraded";
  return "ok";
}

function formatRelativeTime(iso) {
  if (!iso) return "never synced";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never synced";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function SystemPill() {
  const { statuses, accounts } = useIngestionStatus();
  const autopilot = useAutopilotStatus();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const dataState = deriveDataPillState({ statuses, accounts });
  const autopilotState = autopilot.pausedAll ? "paused" : autopilot.state || "disabled";

  const dataSignal = DATA_SIGNAL_BY_STATE[dataState] || "degraded";
  const autopilotSignal = AUTOPILOT_SIGNAL_BY_STATE[autopilotState] || "degraded";
  const overall = aggregateSignal(dataSignal, autopilotSignal);
  const dot = SIGNAL[overall].dotColor;

  const dataLabel = DATA_LABEL_BY_STATE[dataState] || "Unknown";
  const autopilotLabel = autopilot.pausedAll
    ? "Paused (all)"
    : AUTOPILOT_LABEL_BY_STATE[autopilotState] || "Unknown";

  const failure = mostRecentFailure(statuses);
  const lastSync = (statuses || [])
    .filter((s) => s.last_sync_at)
    .sort(
      (a, b) => new Date(b.last_sync_at).getTime() - new Date(a.last_sync_at).getTime()
    )[0];
  const lastSyncRel = formatRelativeTime(lastSync?.last_sync_at);

  const tooltip = `Data ${dataLabel.toLowerCase()} · Autopilot ${autopilotLabel.toLowerCase()}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        title={tooltip}
        aria-label={`System status: ${SIGNAL[overall].label}. ${tooltip}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="system-pill"
        data-overall={overall}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          height: 22,
          fontSize: 11,
          fontWeight: 500,
          color: "#374151",
          background: "#fafafa",
          border: "1px solid #e5e5e5",
          borderRadius: 9999,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <span
          data-testid="system-pill-dot"
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: dot,
            flexShrink: 0,
          }}
        />
        System
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="System status"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 6,
            width: 320,
            background: "var(--card, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 12,
            boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
            zIndex: 220,
          }}
        >
          <div
            data-testid="system-pill-row-data"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderBottom: "1px solid var(--border, #e5e7eb)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: SIGNAL[dataSignal].dotColor,
                marginTop: 5,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text, #111827)" }}>
                Data sync · {dataLabel}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary, #6b7280)", marginTop: 2 }}>
                {dataState === "not_configured"
                  ? "No AWS accounts connected"
                  : `Last sync ${lastSyncRel}`}
              </div>
              {failure && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: "#b91c1c",
                    marginTop: 4,
                  }}
                >
                  <AlertTriangle size={11} aria-hidden />
                  <span
                    title={failure.error_details || "Failure"}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {failure.error_details || "Most recent failure"}
                  </span>
                </div>
              )}
              <Link
                to="/ingestion"
                data-testid="system-pill-ingestion-link"
                onClick={() => setOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--primary, #3b82f6)",
                  textDecoration: "none",
                }}
              >
                View ingestion <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
          <div
            data-testid="system-pill-row-autopilot"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: SIGNAL[autopilotSignal].dotColor,
                marginTop: 5,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text, #111827)" }}>
                Autopilot · {autopilotLabel}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary, #6b7280)", marginTop: 2 }}>
                {autopilot.pausedAll
                  ? "All rules paused — bulk pause active"
                  : `${autopilot.activeRuleCount ?? 0} active rule${
                      (autopilot.activeRuleCount ?? 0) === 1 ? "" : "s"
                    }`}
              </div>
              <Link
                to="/autopilot"
                data-testid="system-pill-autopilot-link"
                onClick={() => setOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--primary, #3b82f6)",
                  textDecoration: "none",
                }}
              >
                Open Autopilot <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
