/**
 * Reusable status pill for subsystem-level indicators in the top bar.
 *
 * Used by the Autopilot pill (always rendered) and the Data pill (added in
 * Task 04). Two pills must stay visually parallel — same height, padding,
 * dot size, and state→color mapping — so all visual configuration lives
 * here and consumers only pass their subsystem name + state key.
 *
 * States are keyed strings (e.g. "active", "issue") so each subsystem can
 * define its own vocabulary. State → { label, dotColor, background, textColor }
 * is passed via stateConfig.
 *
 * On narrow viewports (< NARROW_VIEWPORT_PX), the pill collapses to an
 * icon + dot — the subsystem/state text moves into title + aria-label.
 */
import React, { useEffect, useState } from "react";

export const NARROW_VIEWPORT_PX = 720;

function useIsNarrowViewport() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < NARROW_VIEWPORT_PX : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setNarrow(window.innerWidth < NARROW_VIEWPORT_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}

export default function StatusPill({
  subsystem,
  state,
  stateConfig,
  icon: Icon,
  onClick,
  ariaLabel,
  ariaHasPopup,
  ariaExpanded,
  buttonRef,
}) {
  const narrow = useIsNarrowViewport();
  const conf = stateConfig[state] || stateConfig.default || {
    label: state,
    dotColor: "#9ca3af",
    background: "#f3f4f6",
    textColor: "#4b5563",
  };
  const visibleText = narrow ? null : `${subsystem}: ${conf.label}`;
  const resolvedAriaLabel = ariaLabel || `${subsystem} status: ${conf.label}`;
  const resolvedTitle = `${subsystem}: ${conf.label}`;

  const content = (
    <>
      {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: conf.dotColor,
          flexShrink: 0,
        }}
        aria-hidden
      />
      {visibleText && <span>{visibleText}</span>}
    </>
  );

  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: narrow ? "6px 8px" : "6px 12px",
    height: 28,
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0,
    background: conf.background,
    color: conf.textColor,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  if (onClick) {
    return (
      <button
        type="button"
        ref={buttonRef}
        onClick={onClick}
        title={resolvedTitle}
        aria-label={resolvedAriaLabel}
        aria-haspopup={ariaHasPopup}
        aria-expanded={ariaExpanded}
        style={{ ...baseStyle, cursor: "pointer" }}
        data-testid={`status-pill-${subsystem.toLowerCase()}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      title={resolvedTitle}
      aria-label={resolvedAriaLabel}
      role="status"
      style={baseStyle}
      data-testid={`status-pill-${subsystem.toLowerCase()}`}
    >
      {content}
    </span>
  );
}
