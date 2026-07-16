import React from "react";

export const STATUS_COLORS = {
  connected: { bg: "var(--success-bg, #ecfdf5)", color: "var(--success, #059669)", dot: "#059669" },
  incomplete: { bg: "#fffbeb", color: "#d97706", dot: "#d97706" },
  disconnected: { bg: "#fef2f2", color: "#dc2626", dot: "#dc2626" },
  inactive: { bg: "var(--bg-inset)", color: "var(--text-tertiary)", dot: "var(--text-tertiary)" },
};

const STEP_ICON = {
  pass: "✅",
  fail: "❌",
  skip: "⏭️",
  pending: "⏳",
};

const STEP_COLOR = {
  pass: "var(--success, #059669)",
  fail: "var(--danger, #dc2626)",
  skip: "var(--text-tertiary)",
  pending: "var(--text-tertiary)",
};

export function StatusDot({ status }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.inactive;
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: style.dot,
        flexShrink: 0,
      }}
      title={status}
    />
  );
}

export function ValidationSteps({
  validation,
  title = "Validation Results",
  testId,
  stepTestIdPrefix,
}) {
  if (!validation?.steps) return null;
  return (
    <div
      className="mt-3 p-3 rounded-lg border text-xs"
      style={{ borderColor: "var(--border)", background: "var(--bg-inset)" }}
      data-testid={testId}
    >
      <p className="font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      <div className="space-y-2">
        {validation.steps.map((s, i) => (
          <div
            key={i}
            data-testid={
              stepTestIdPrefix ? `${stepTestIdPrefix}${s.name || i}` : undefined
            }
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true">{STEP_ICON[s.status] || "❓"}</span>
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {s.label}
              </span>
              {s.detail && (
                <span style={{ color: STEP_COLOR[s.status] || "var(--text-tertiary)" }}>
                  {" "}&mdash; {s.detail}
                </span>
              )}
            </div>
            {s.error && (
              <p
                className="ml-6 mt-0.5 font-mono"
                style={{ color: "var(--danger, #dc2626)", wordBreak: "break-all" }}
              >
                {s.error}
              </p>
            )}
            {s.remediation && s.status === "fail" && (
              <p className="ml-6 mt-0.5" style={{ color: "var(--text-muted)" }}>
                {s.remediation}
              </p>
            )}
          </div>
        ))}
      </div>
      {validation.overall_status && (
        <div
          className="mt-2 pt-2 border-t flex items-center gap-2"
          style={{ borderColor: "var(--border)" }}
        >
          <StatusDot status={validation.overall_status} />
          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
            Overall: {validation.overall_status}
          </span>
        </div>
      )}
    </div>
  );
}
