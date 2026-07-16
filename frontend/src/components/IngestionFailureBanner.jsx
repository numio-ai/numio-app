/**
 * Global app-shell banner for failing ingestion.
 *
 * Renders at the top of the authenticated layout whenever the aggregate
 * Data pill state resolves to "issue" (hard failure). Dismissible per
 * session; a *new* failure (different most-recent timestamp) re-shows
 * the banner even after dismissal so users don't silently miss a fresh
 * incident.
 *
 * Coexists with other existing banners (CostsMtdBanner, etc.) and
 * stacks above them per the layout.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { useIngestionStatus } from "../context/IngestionStatusContext";
import {
  deriveDataPillState,
  mostRecentFailure,
  failingAccountCount,
} from "../lib/ingestionStatus";

const DISMISS_PREFIX = "numio.ingestion-banner.dismissed";

function dismissKey(workspaceId, lastFailureAt) {
  const ws = workspaceId || "default";
  const ts = lastFailureAt || "unknown";
  return `${DISMISS_PREFIX}:${ws}:${ts}`;
}

export default function IngestionFailureBanner() {
  const { statuses, accounts } = useIngestionStatus();
  const [dismissedKey, setDismissedKey] = useState(null);

  const state = deriveDataPillState({ statuses, accounts });
  const failure = useMemo(() => mostRecentFailure(statuses), [statuses]);
  const count = useMemo(() => failingAccountCount(statuses), [statuses]);
  const workspaceId = failure?.workspace_id || statuses?.[0]?.workspace_id;
  const currentKey = failure ? dismissKey(workspaceId, failure.last_sync_at) : null;

  // On mount & whenever the failure key changes, read from sessionStorage to
  // decide if this exact failure has already been dismissed.
  useEffect(() => {
    if (!currentKey) {
      setDismissedKey(null);
      return;
    }
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(currentKey)) {
        setDismissedKey(currentKey);
      } else {
        setDismissedKey(null);
      }
    } catch {
      setDismissedKey(null);
    }
  }, [currentKey]);

  if (state !== "issue") return null;
  if (dismissedKey && dismissedKey === currentKey) return null;

  const handleDismiss = () => {
    try {
      if (typeof sessionStorage !== "undefined" && currentKey) {
        sessionStorage.setItem(currentKey, "1");
      }
    } catch {
      /* ignore */
    }
    setDismissedKey(currentKey);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="ingestion-failure-banner"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "#fef2f2",
        borderBottom: "1px solid #fecaca",
        color: "#991b1b",
        fontSize: 13,
      }}
    >
      <AlertTriangle size={16} color="#dc2626" aria-hidden style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, marginRight: 8 }}>Data ingestion failing</span>
        <span style={{ color: "#b91c1c" }}>
          {count} account{count === 1 ? "" : "s"} failing. Costs and reports may be stale or incomplete.
        </span>
      </div>
      <Link
        to="/ingestion"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#991b1b",
          textDecoration: "underline",
          flexShrink: 0,
        }}
      >
        View details →
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss ingestion failure banner"
        title="Dismiss"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          padding: 0,
          borderRadius: 6,
          background: "transparent",
          border: "none",
          color: "#b91c1c",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
