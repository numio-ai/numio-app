import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getCfnTemplate,
  getCfnTemplateDownloadUrl,
} from "../../api/onboarding";
import { registerAccount } from "../../api/workspace";
import { triggerJob } from "../../api/jobs";

/**
 * Chat-driven onboarding v0 — scripted, feature-flagged.
 *
 * This is a self-contained chat-styled surface that delivers the same
 * CloudFormation onboarding as the Guided wizard, as a turn-by-turn scripted
 * conversation. It does NOT run through the LLM chat backend (LMGate or
 * Anthropic) — v0 is a finite state machine with constrained inputs. v1
 * will host the flow in the LLM-backed ChatPanel.
 *
 * State machine:
 *   greet → region → bucket → apply → waiting → outputs → verify → success
 *
 * Reuses the template generator from `aws_cfn_template_generator` and the
 * registerAccount + validation path from the Advanced form. No account row
 * is persisted until the user reaches `verify`, so exiting to the hub at any
 * earlier turn leaves the database clean.
 */

const COMMON_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
];

const DEFAULT_FORM = {
  region: "",
  curBucketName: "",
  curPathPrefix: "cur",
  curReportName: "",
  awsAccountId: "",
  roleArn: "",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  externalId: "",
};

const STATUS_ICON = { pass: "✅", fail: "❌", skip: "⏭" };

function Bubble({ role, children, testid }) {
  const fromAssistant = role === "assistant";
  return (
    <div
      className="flex mb-3"
      style={{
        justifyContent: fromAssistant ? "flex-start" : "flex-end",
      }}
      data-testid={testid}
    >
      <div
        className="px-3 py-2 rounded-lg"
        style={{
          maxWidth: "85%",
          background: fromAssistant
            ? "var(--bg-inset)"
            : "var(--primary)",
          color: fromAssistant ? "var(--text)" : "#fff",
          border: fromAssistant ? "1px solid var(--border)" : "none",
          fontSize: 13,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function QuickReplies({ children }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3 justify-end">{children}</div>
  );
}

function QuickReply({ label, onClick, testid, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className="btn btn--ghost btn--sm"
      style={{
        border: "1px solid var(--primary)",
        color: "var(--primary)",
        background: "var(--bg)",
      }}
    >
      {label}
    </button>
  );
}

export default function ChatOnboarding({
  form: externalForm,
  setForm: setExternalForm,
  onBack,
  onAccountRegistered,
  onDone,
}) {
  const form = useMemo(
    () => ({ ...DEFAULT_FORM, ...(externalForm || {}) }),
    [externalForm],
  );
  const setForm = setExternalForm;
  const patch = (delta) => setForm({ ...form, ...delta });

  const [turn, setTurn] = useState("greet");
  const [cfn, setCfn] = useState(null);
  const [cfnLoading, setCfnLoading] = useState(false);
  const [cfnError, setCfnError] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [registered, setRegistered] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [customRegion, setCustomRegion] = useState("");
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when a new turn arrives so the latest prompt is
  // always in view.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turn, cfn, validation]);

  // Fetch the template when we first enter the Apply turn.
  useEffect(() => {
    if (turn !== "apply") return;
    let cancelled = false;
    setCfnLoading(true);
    setCfnError(null);
    getCfnTemplate({
      region: form.region,
      curBucketName: form.curBucketName,
      curReportName: form.curReportName,
      curPathPrefix: form.curPathPrefix,
    })
      .then((r) => {
        if (!cancelled) setCfn(r);
      })
      .catch((e) => {
        if (!cancelled) setCfnError(e.message || "Failed to generate template");
      })
      .finally(() => {
        if (!cancelled) setCfnLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  const handleVerify = async () => {
    setValidating(true);
    setValidation(null);
    try {
      const result = await registerAccount({
        aws_account_id: form.awsAccountId,
        alias: `AWS ${form.awsAccountId}`,
        role_arn: form.roleArn,
        external_id: form.externalId,
        aws_access_key_id: form.awsAccessKeyId,
        aws_secret_access_key: form.awsSecretAccessKey,
        environment_label: "production",
        cur_s3_bucket: form.curBucketName,
        cur_s3_prefix: form.curPathPrefix,
        cur_report_name: form.curReportName,
      });
      setValidation(result.validation);
      setRegistered(result.account);
      if (onAccountRegistered) onAccountRegistered(result.account);
      if (result.validation?.overall_status === "connected") {
        setTurn("success");
      }
    } catch (e) {
      try {
        const parsed = JSON.parse(e.message);
        if (parsed?.validation) {
          setValidation(parsed.validation);
        } else {
          setValidation({
            overall_status: "disconnected",
            steps: [{ label: "Registration", status: "fail", error: e.message }],
          });
        }
      } catch {
        setValidation({
          overall_status: "disconnected",
          steps: [
            { label: "Registration", status: "fail", error: e.message || "Unknown error" },
          ],
        });
      }
    } finally {
      setValidating(false);
    }
  };

  const handleTriggerSync = async () => {
    setTriggering(true);
    try {
      await triggerJob("cur_ingestion");
    } catch {
      // Non-fatal — the user can trigger from the Jobs page.
    } finally {
      setTriggered(true);
      setTriggering(false);
    }
  };

  return (
    <div
      className="rounded-lg border mb-4 flex flex-col"
      style={{
        borderColor: "var(--primary)",
        background: "var(--bg)",
        minHeight: 480,
      }}
      data-testid="onboarding-chat"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          Chat-driven onboarding (beta)
        </p>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onBack}
          data-testid="chat-back-to-hub"
        >
          ← Back to methods
        </button>
      </div>

      {/* Conversation */}
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{ maxHeight: 520 }}
        ref={scrollRef}
        data-testid="chat-scroll"
      >
        {/* Greet turn */}
        <Bubble role="assistant" testid="chat-msg-greet">
          Hi — I'll walk you through connecting an AWS account. It takes
          about 5 minutes and we'll do everything here in chat. Ready to
          start?
        </Bubble>
        {turn !== "greet" && (
          <Bubble role="user" testid="chat-user-greet">
            Yes, let's go.
          </Bubble>
        )}

        {/* Region turn */}
        {turn !== "greet" && (
          <>
            <Bubble role="assistant" testid="chat-msg-region">
              What AWS region is your billing data in? us-east-1 is the most
              common.
            </Bubble>
            {form.region && turn !== "region" && (
              <Bubble role="user" testid="chat-user-region">
                {form.region}
              </Bubble>
            )}
          </>
        )}

        {/* Bucket turn */}
        {turn !== "greet" && turn !== "region" && (
          <>
            <Bubble role="assistant" testid="chat-msg-bucket">
              What's the name of the S3 bucket that holds your Cost and Usage
              Report export? If you don't have one yet, just say "skip" and
              we'll set one up later.
            </Bubble>
            {(form.curBucketName || ["apply", "waiting", "outputs", "verify", "success"].includes(turn)) && (
              <Bubble role="user" testid="chat-user-bucket">
                {form.curBucketName || "skip"}
              </Bubble>
            )}
          </>
        )}

        {/* Apply turn */}
        {["apply", "waiting", "outputs", "verify", "success"].includes(turn) && (
          <>
            <Bubble role="assistant" testid="chat-msg-apply">
              {cfnLoading && "Generating a CloudFormation template for your workspace…"}
              {cfnError && `Something went wrong: ${cfnError}`}
              {cfn && (
                <>
                  Here's your CloudFormation template. Launch it in the AWS
                  Console in region <code>{cfn.region}</code> (one click), or
                  download it and upload it manually.
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <a
                      href={cfn.launch_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--primary btn--sm"
                      data-testid="chat-launch-url"
                    >
                      Launch in AWS ↗
                    </a>
                    <a
                      href={getCfnTemplateDownloadUrl({
                        region: form.region,
                        curBucketName: form.curBucketName,
                        curReportName: form.curReportName,
                        curPathPrefix: form.curPathPrefix,
                      })}
                      download="numio-onboarding.yaml"
                      className="btn btn--primary btn--sm"
                      data-testid="chat-download-url"
                    >
                      Download YAML
                    </a>
                  </div>
                </>
              )}
            </Bubble>
          </>
        )}

        {/* Waiting turn prompt */}
        {["waiting", "outputs", "verify", "success"].includes(turn) && (
          <Bubble role="assistant" testid="chat-msg-waiting">
            Reply here when the CloudFormation stack reaches{" "}
            <strong>CREATE_COMPLETE</strong> (usually under 2 minutes).
          </Bubble>
        )}

        {/* Outputs turn */}
        {["outputs", "verify", "success"].includes(turn) && (
          <Bubble role="assistant" testid="chat-msg-outputs">
            Great — now paste the five CloudFormation Outputs here.
          </Bubble>
        )}

        {/* Verify turn result */}
        {turn === "verify" && validation && (
          <Bubble role="assistant" testid="chat-msg-verify">
            <div>
              <p className="mb-2 font-semibold">Verification results</p>
              <ul className="space-y-1">
                {validation.steps.map((s, i) => (
                  <li key={i} data-testid={`chat-validation-${s.name || i}`}>
                    <span aria-hidden="true">{STATUS_ICON[s.status] || "❓"}</span>{" "}
                    {s.label}
                    {s.error && (
                      <div
                        className="font-mono mt-1"
                        style={{
                          color: "var(--danger, #dc2626)",
                          fontSize: 11,
                          wordBreak: "break-all",
                        }}
                      >
                        {s.error}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Bubble>
        )}

        {turn === "success" && (
          <Bubble role="assistant" testid="chat-msg-success">
            ✅ You're connected. {registered?.alias || "Your AWS account"} is
            now reading cost data. Want me to kick off the first sync right
            now?
          </Bubble>
        )}
      </div>

      {/* Input area — turn-specific quick replies / form */}
      <div
        className="p-3 border-t"
        style={{ borderColor: "var(--border)", background: "var(--bg-inset)" }}
      >
        {turn === "greet" && (
          <QuickReplies>
            <QuickReply
              label="Yes, let's go"
              onClick={() => setTurn("region")}
              testid="chat-qr-start"
            />
            <QuickReply
              label="Not now"
              onClick={onBack}
              testid="chat-qr-abort"
            />
          </QuickReplies>
        )}

        {turn === "region" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_REGIONS.map((r) => (
                <QuickReply
                  key={r}
                  label={r}
                  onClick={() => {
                    patch({ region: r });
                    setTurn("bucket");
                  }}
                  testid={`chat-region-${r}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="formInput formInput--small flex-1"
                value={customRegion}
                onChange={(e) => setCustomRegion(e.target.value)}
                placeholder="Or type a region (e.g. eu-north-1)"
                data-testid="chat-region-custom"
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={!customRegion}
                onClick={() => {
                  patch({ region: customRegion });
                  setTurn("bucket");
                }}
                data-testid="chat-region-submit"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {turn === "bucket" && (
          <div>
            <BucketInput
              onSubmit={(bucket) => {
                patch({ curBucketName: bucket === "skip" ? "" : bucket });
                setTurn("apply");
              }}
            />
          </div>
        )}

        {turn === "apply" && (
          <QuickReplies>
            <QuickReply
              label="I applied the stack"
              onClick={() => setTurn("waiting")}
              testid="chat-qr-applied"
              disabled={!cfn}
            />
            <QuickReply
              label="Having trouble?"
              onClick={() => setTurn("apply-help")}
              testid="chat-qr-help"
            />
          </QuickReplies>
        )}

        {turn === "apply-help" && (
          <div>
            <Bubble role="assistant" testid="chat-msg-help">
              Two common issues: the AWS Console needs the "Upload a template
              file" option in upload mode, and the stack must finish with
              CREATE_COMPLETE (not CREATE_IN_PROGRESS).
            </Bubble>
            <QuickReplies>
              <QuickReply
                label="OK, I'll try again"
                onClick={() => setTurn("apply")}
                testid="chat-qr-help-back"
              />
            </QuickReplies>
          </div>
        )}

        {turn === "waiting" && (
          <QuickReplies>
            <QuickReply
              label="I'm done"
              onClick={() => setTurn("outputs")}
              testid="chat-qr-stack-done"
            />
            <QuickReply
              label="Not yet"
              onClick={() => setTurn("apply")}
              testid="chat-qr-stack-wait"
            />
          </QuickReplies>
        )}

        {turn === "outputs" && (
          <OutputsForm
            form={form}
            patch={patch}
            onSubmit={() => {
              setTurn("verify");
              handleVerify();
            }}
          />
        )}

        {turn === "verify" && validating && (
          <p
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Running verification…
          </p>
        )}

        {turn === "verify" && !validating && validation && validation.overall_status !== "connected" && (
          <QuickReplies>
            <QuickReply
              label="Retry verification"
              onClick={handleVerify}
              testid="chat-qr-retry-verify"
            />
            <QuickReply
              label="Fix outputs"
              onClick={() => setTurn("outputs")}
              testid="chat-qr-fix-outputs"
            />
          </QuickReplies>
        )}

        {turn === "success" && (
          <QuickReplies>
            <QuickReply
              label={
                triggered
                  ? "First sync queued"
                  : triggering
                  ? "Starting…"
                  : "Yes — trigger first sync"
              }
              onClick={handleTriggerSync}
              disabled={triggering || triggered}
              testid="chat-qr-trigger"
            />
            <QuickReply
              label="Later"
              onClick={onDone}
              testid="chat-qr-done"
            />
          </QuickReplies>
        )}
      </div>
    </div>
  );
}

function BucketInput({ onSubmit }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2">
      <input
        className="formInput formInput--small flex-1"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Type the bucket name, or 'skip'"
        data-testid="chat-bucket-input"
      />
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={!v}
        onClick={() => onSubmit(v)}
        data-testid="chat-bucket-submit"
      >
        Send
      </button>
    </div>
  );
}

function OutputsForm({ form, patch, onSubmit }) {
  const fields = [
    { key: "awsAccountId", label: "AwsAccountId", placeholder: "123456789012" },
    {
      key: "roleArn",
      label: "RoleArn",
      placeholder: "arn:aws:iam::...:role/numio/NumioCurReaderRole",
    },
    { key: "awsAccessKeyId", label: "AccessKeyId", placeholder: "AKIA..." },
    {
      key: "awsSecretAccessKey",
      label: "SecretAccessKey",
      placeholder: "CFN output value",
      type: "password",
    },
    { key: "externalId", label: "ExternalId", placeholder: "UUID from outputs" },
  ];
  const allFilled = fields.every((f) => (form[f.key] || "").trim());
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        {fields.map((f) => (
          <label key={f.key} className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {f.label}
            <input
              className="formInput formInput--small w-full mt-1"
              value={form[f.key] || ""}
              onChange={(e) => patch({ [f.key]: e.target.value })}
              placeholder={f.placeholder}
              type={f.type || "text"}
              data-testid={`chat-output-${f.key}`}
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={!allFilled}
          onClick={onSubmit}
          data-testid="chat-outputs-submit"
        >
          Verify connection
        </button>
      </div>
    </div>
  );
}
