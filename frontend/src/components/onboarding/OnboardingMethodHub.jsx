import React from "react";
import { FaAws } from "react-icons/fa6";

/**
 * Method picker shown when the user clicks "+ Add Account".
 *
 * Guided is visually dominant (primary card); Advanced is a de-emphasized
 * secondary link so it does not confuse non-technical users. Chat is only
 * rendered when the server-side `ONBOARDING_CHAT_ENABLED` flag is true.
 *
 * The parent owns method-specific form state — this component only emits
 * `onSelect(method)` callbacks and a cancel signal.
 */
export default function OnboardingMethodHub({
  chatEnabled,
  onSelect,
  onCancel,
}) {
  return (
    <div
      className="p-4 rounded-lg border mb-4"
      style={{ borderColor: "var(--primary)", background: "var(--bg)" }}
      data-testid="onboarding-method-hub"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FaAws size={18} style={{ color: "var(--text)" }} />
          <p
            className="font-semibold text-sm"
            style={{ color: "var(--text)" }}
          >
            Connect an AWS account
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onCancel}
            data-testid="onboarding-hub-cancel"
          >
            Cancel
          </button>
        )}
      </div>

      <p
        className="text-xs mb-4"
        style={{ color: "var(--text-muted)" }}
      >
        Choose how you want to give Numio read access. Most people should start
        with <strong>Guided</strong>.
      </p>

      {/* Primary: Guided */}
      <button
        type="button"
        onClick={() => onSelect("guided")}
        data-testid="onboarding-method-guided"
        className="w-full text-left p-4 rounded-lg border mb-3"
        style={{
          borderColor: "var(--primary)",
          background: "var(--bg-inset)",
          borderWidth: 2,
          cursor: "pointer",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ gap: 12 }}
        >
          <div>
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--text)" }}
            >
              Guided setup{" "}
              <span
                className="text-xs font-medium ml-2 px-2 py-0.5 rounded-full"
                style={{
                  background: "var(--primary)",
                  color: "#fff",
                }}
              >
                Recommended
              </span>
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              For AWS admins who have not set up IAM roles for Numio yet. We
              generate a CloudFormation template that creates everything in
              one click, then verify the connection for you.
            </p>
            <p
              className="text-xs mt-2"
              style={{ color: "var(--text-muted)" }}
            >
              ⏱ About 5 minutes · No CLI needed · No IAM or S3 policy
              knowledge required.
            </p>
          </div>
          <span
            aria-hidden="true"
            style={{
              fontSize: 24,
              color: "var(--primary)",
              flexShrink: 0,
            }}
          >
            →
          </span>
        </div>
      </button>

      {/* Chat — flagged */}
      {chatEnabled && (
        <button
          type="button"
          onClick={() => onSelect("chat")}
          data-testid="onboarding-method-chat"
          className="w-full text-left p-4 rounded-lg border mb-3"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-inset)",
            cursor: "pointer",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ gap: 12 }}
          >
            <div>
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--text)" }}
              >
                Chat-driven setup{" "}
                <span
                  className="text-xs font-medium ml-2 px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--bg)",
                    color: "var(--text-tertiary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Beta
                </span>
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Same CloudFormation flow, but guided by a conversation in the
                Numio chat panel. Good if you prefer step-by-step prompts over
                a wizard.
              </p>
            </div>
            <span
              aria-hidden="true"
              style={{
                fontSize: 24,
                color: "var(--text-tertiary)",
                flexShrink: 0,
              }}
            >
              →
            </span>
          </div>
        </button>
      )}

      {/* Advanced — de-emphasised secondary link, not a sibling card */}
      <div
        className="mt-2 pt-3 border-t text-xs"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        Already have an IAM role and CUR bucket set up?{" "}
        <button
          type="button"
          onClick={() => onSelect("advanced")}
          data-testid="onboarding-method-advanced"
          className="btn btn--ghost"
          style={{
            padding: 0,
            minWidth: 0,
            textDecoration: "underline",
            color: "var(--text-secondary)",
            fontSize: 12,
          }}
        >
          Use the Advanced form instead
        </button>
        .
      </div>
    </div>
  );
}
