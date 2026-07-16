import React, { useEffect, useRef, useState } from "react";
import {
  deleteOnboardingInProgress,
  getCfnTemplate,
  getCfnTemplateDownloadUrl,
  putOnboardingInProgress,
} from "../../api/onboarding";
import {
  listAccounts,
  registerAccount,
  updateAccount,
} from "../../api/workspace";
import { triggerJob } from "../../api/jobs";
import { ValidationSteps } from "./ValidationSteps";
import { validateCfnField } from "./cfnValidation";

// CUR fields validated against the CloudFormation AllowedPattern constraints
// before template generation. Keys map form-field names to validator kinds
// defined in cfnValidation.js.
const CUR_FIELD_KINDS = {
  curBucketName: "bucket",
  curPathPrefix: "prefix",
  curReportName: "report",
};

// Steps for which we PUT to the in-progress endpoint. Mirrors backend
// PERSISTED_STEPS in numio.models.onboarding_in_progress. Intro and Success
// are excluded — Intro is pre-submission, Success means we just deleted.
const PERSISTED_STEPS = new Set(["customize", "apply", "waiting", "verify"]);

// Mirrors backend validate_account response: same step `name` keys and labels.
// Used to render placeholder rows while the validation request is in flight,
// so the Verify step shows immediate per-step progress instead of an opaque
// spinner. On response, the real rows replace these.
const PENDING_VALIDATION = {
  steps: [
    { name: "credentials", label: "Verify AWS credentials", status: "pending" },
    { name: "role_assume", label: "Assume customer role", status: "pending" },
    { name: "s3_list", label: "List CUR objects in S3", status: "pending" },
    { name: "s3_read", label: "Read CUR file from S3", status: "pending" },
  ],
};

/**
 * Guided CloudFormation onboarding wizard.
 *
 * Steps:
 *   (a) Intro       — what the wizard does, what Numio needs.
 *   (b) Customize   — CUR bucket name, region, optional display name.
 *   (c) Apply stack — Launch URL + Download + copy-paste fallback.
 *   (d) Waiting     — the user returns once the stack is CREATE_COMPLETE and
 *                     pastes the CloudFormation Outputs back into Numio.
 *   (e) Verify      — submit to `registerAccount`; display per-step pass/fail
 *                     from the existing validation logic inline.
 *   (f) Success     — shows connected state + "Trigger first sync" CTA.
 *
 * `form` is owned by the parent so Back / Cancel / method-switch preserve
 * every field. The wizard is otherwise self-contained.
 */

const STEPS = [
  { id: "intro", label: "Intro" },
  { id: "customize", label: "Customize" },
  { id: "apply", label: "Apply" },
  { id: "waiting", label: "Waiting" },
  { id: "verify", label: "Verify" },
  { id: "success", label: "Done" },
];

const DEFAULT_FORM = {
  region: "us-east-1",
  // CUR provisioning mode. "create_new" (default) — Numio provisions the
  // S3 bucket and CUR 2.0 Data Export inside the same stack and locks the
  // region to us-east-1. "existing" — the operator points at a CUR export
  // they already have.
  curMode: "create_new",
  // Empty by default. In create_new mode the Customize step seeds these
  // from the label (numio-cur-<label> / daily / numio-cur-<label>) and
  // refreshes them on label changes until the user types a custom value.
  curBucketName: "",
  curPathPrefix: "",
  curReportName: "",
  alias: "",
  // Per-instance label embedded in IAM names, stack name, and tags. Seeded
  // on first mount with the current local time as DDMMYYHHMM.
  label: "",
  // When true, the stack also provisions NumioTagWriterRole so Numio can
  // write tags. Off by default — tag writes are an explicit opt-in.
  enableTagWrites: false,
  // CloudFormation Output paste-back fields.
  awsAccountId: "",
  roleArn: "",
  // TagWriterRoleArn stack output — pasted back only when tag writes enabled.
  tagWriterRoleArn: "",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  externalId: "",
};

// Auto-derived names in create_new mode. Mirrors backend
// numio.onboarding.cfn_template.cur_bucket_name_for / cur_report_name_for so
// the operator sees the same values the rendered template will use.
const CREATE_NEW_PATH_PREFIX = "daily";
const curBucketNameFor = (label) => `numio-cur-${label || ""}`;
const curReportNameFor = (label) => `numio-cur-${label || ""}`;

// Mirrors backend numio.onboarding.cfn_template.LABEL_PATTERN. The UI uses
// it for instant Generate-button enable/disable; the server is authoritative.
export const LABEL_REGEX = /^[a-z0-9][a-z0-9-]{0,31}$/;

const hasEmbeddedSpace = (v) => typeof v === "string" && /\s/.test(v.trim());

const EmbeddedSpaceWarning = ({ value }) =>
  hasEmbeddedSpace(value) ? (
    <p className="text-xs mt-1" style={{ color: "var(--danger, #dc2626)" }}>
      This value contains a space — AWS identifiers do not allow spaces.
    </p>
  ) : null;

/**
 * Default label = current local time in DDMMYYHHMM format. Example: at
 * 2026-04-26 19:50 the default is "2604261950". Operators typically
 * override this with something more meaningful (worktree name, initials +
 * date, deployment tag) before submitting, but the timestamp is a valid
 * fallback so the field is never blank on first render.
 */
export function defaultLabel(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(now.getDate());
  const mm = pad(now.getMonth() + 1);
  const yy = pad(now.getFullYear() % 100);
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  return `${dd}${mm}${yy}${hh}${mi}`;
}

function StepBreadcrumb({ current }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol
      className="flex items-center gap-2 text-xs mb-4"
      style={{ color: "var(--text-muted)" }}
      aria-label="Wizard progress"
    >
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: active
                  ? "var(--primary)"
                  : done
                  ? "var(--success, #059669)"
                  : "var(--bg-inset)",
                color: active || done ? "#fff" : "var(--text-tertiary)",
                border: active ? "none" : "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              style={{
                color: active ? "var(--text)" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" style={{ color: "var(--border)" }}>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function GuidedOnboarding({
  form: externalForm,
  setForm: setExternalForm,
  initialStep,
  onBack,
  onDone,
  onAccountRegistered,
}) {
  // Merge parent-owned form with defaults so omitted keys have sane values.
  const form = { ...DEFAULT_FORM, ...(externalForm || {}) };
  const setForm = (next) => setExternalForm(next);

  // Per-field error map for the three CUR inputs. An entry only appears
  // after the user blurs a field with an invalid value; it clears as soon
  // as the value becomes valid again on change. Used both for inline error
  // rendering and to disable the Customize → Apply button while invalid.
  const [cfnFieldErrors, setCfnFieldErrors] = useState({});

  const updateField = (key) => (e) => {
    const trimmed = e.target.value.trim();
    setForm({ ...form, [key]: trimmed });
    // For validated CUR fields, clear an existing error the moment the
    // value becomes valid again — never re-introduce one mid-typing.
    const kind = CUR_FIELD_KINDS[key];
    if (kind && cfnFieldErrors[key]) {
      const err = validateCfnField(kind, trimmed);
      if (!err) {
        setCfnFieldErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
  };

  const handleCfnBlur = (key) => (e) => {
    const kind = CUR_FIELD_KINDS[key];
    if (!kind) return;
    // Read straight from the DOM rather than the closed-over `form` state,
    // because a change event firing immediately before this blur may not
    // have committed yet — closure would see the prior value.
    const value = (e?.target?.value ?? form[key] ?? "").trim();
    const err = validateCfnField(kind, value);
    setCfnFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[key] = err;
      else delete next[key];
      return next;
    });
  };

  // Computed from current values, not from cfnFieldErrors, so the Next
  // button is disabled even before the user has blurred a freshly invalid
  // field (e.g. paste then click).
  const cfnFieldsValid = Object.entries(CUR_FIELD_KINDS).every(
    ([key, kind]) => !validateCfnField(kind, form[key]),
  );

  // Seed the label with a DDMMYYHHMM timestamp on first mount if the parent
  // didn't pre-fill one. We only set it once so the user's edits stick.
  useEffect(() => {
    if (!form.label) {
      setForm({ ...form, label: defaultLabel() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labelTouched = (form.label ?? "") !== "";
  const labelValid = LABEL_REGEX.test(form.label ?? "");

  // When initialStep is one of the persisted steps, the wizard was
  // auto-restored from the backend — start there and treat persistence as
  // already established for this session.
  const restoredStep =
    initialStep && PERSISTED_STEPS.has(initialStep) ? initialStep : "intro";
  const [step, setStep] = useState(restoredStep);
  const persistedRef = useRef(restoredStep !== "intro");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelAck, setCancelAck] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cfn, setCfn] = useState(null); // { template_body, launch_url, download_url, launch_mode, ... }
  const [cfnError, setCfnError] = useState(null);
  const [cfnLoading, setCfnLoading] = useState(false);
  const [validation, setValidation] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState(null);
  const [registered, setRegistered] = useState(null); // account object
  const [triggering, setTriggering] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const isCreateNew = (form.curMode || "create_new") === "create_new";
  // Region is the only field still locked by mode — Data Exports / CUR 2.0
  // is a us-east-1-only service. Bucket / prefix / report are always
  // editable; create_new mode just seeds them with sensible defaults.
  const effectiveRegion = isCreateNew ? "us-east-1" : form.region;

  // Track previously-derived CUR field values so the auto-prefill effect can
  // tell "the user has typed a custom value" (don't overwrite) from "the
  // field still holds a value Numio derived" (refresh on label change).
  const prevDerivedRef = useRef({ bucket: "", report: "", prefix: "" });

  // In create_new mode, seed the three CUR fields from the label and keep
  // them in sync as the label changes — but only when the field is empty
  // or still equals the value Numio last derived. Once the user types a
  // custom value, we leave it alone.
  //
  // Gate on labelValid so this effect doesn't race the label-seeding effect
  // on first mount (both call setForm with a stale form closure; the label
  // seeder must win first, then this effect re-fires with the real label).
  useEffect(() => {
    if (!isCreateNew) return;
    if (!labelValid) return;
    const next = {
      bucket: curBucketNameFor(form.label),
      report: curReportNameFor(form.label),
      prefix: CREATE_NEW_PATH_PREFIX,
    };
    const prev = prevDerivedRef.current;
    const updates = {};
    if (!form.curBucketName || form.curBucketName === prev.bucket) {
      if (form.curBucketName !== next.bucket) updates.curBucketName = next.bucket;
    }
    if (!form.curReportName || form.curReportName === prev.report) {
      if (form.curReportName !== next.report) updates.curReportName = next.report;
    }
    if (!form.curPathPrefix || form.curPathPrefix === prev.prefix) {
      if (form.curPathPrefix !== next.prefix) updates.curPathPrefix = next.prefix;
    }
    prevDerivedRef.current = next;
    if (Object.keys(updates).length) {
      setForm({ ...form, ...updates });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateNew, form.label]);

  // On entering the Apply step, fetch a fresh CFN template with the current
  // parameters. Re-fetch when the user edits region / bucket / mode then returns.
  useEffect(() => {
    if (step !== "apply") return;
    let cancelled = false;
    setCfnLoading(true);
    setCfnError(null);
    getCfnTemplate({
      label: form.label,
      region: effectiveRegion,
      curMode: form.curMode || "create_new",
      curBucketName: form.curBucketName,
      curReportName: form.curReportName,
      curPathPrefix: form.curPathPrefix,
      enableTagWrites: form.enableTagWrites,
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
  }, [
    step,
    form.label,
    form.curMode,
    effectiveRegion,
    form.curBucketName,
    form.curReportName,
    form.curPathPrefix,
    form.enableTagWrites,
  ]);

  const verifyRef = useRef(null);

  // Wrap setStep with server-side persistence so a refresh / browser-switch
  // resumes the wizard where the user left off. The first PUT happens at
  // Customize → Apply (the "submit Customize" event) — going to Customize
  // before that does not persist. After that, every transition into a
  // persisted step updates the record. Transitions to Intro or Success are
  // intentionally not persisted (Intro is pre-submission, Success means we
  // just deleted). Persistence is best-effort — a transient backend hiccup
  // never blocks the UI from advancing.
  const goTo = (id) => {
    setStep(id);
    const becomingPersisted = id === "apply" || persistedRef.current;
    if (becomingPersisted && PERSISTED_STEPS.has(id)) {
      persistedRef.current = true;
      putOnboardingInProgress({ label: form.label, step: id }).catch(() => {});
    }
  };

  // Scroll the wizard panel into view on Verify so the state change is
  // visible even when the user was scrolled down on the Waiting step.
  useEffect(() => {
    if (step !== "verify") return;
    const el = verifyRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step]);

  // Names of paste-back fields that are missing in the current form. Drives
  // both the disabled-button-replacement inline error and per-field
  // aria-invalid styling so the user gets a clear "fill these first" cue
  // instead of a silently dead Verify button.
  const missingPasteBackFields = () => {
    const out = [];
    if (!form.awsAccountId) out.push("AwsAccountId");
    if (!form.roleArn) out.push("RoleArn");
    if (!form.awsAccessKeyId) out.push("AccessKeyId");
    if (!form.awsSecretAccessKey) out.push("SecretAccessKey");
    if (!form.externalId) out.push("ExternalId");
    return out;
  };

  const handleVerify = async () => {
    const missing = missingPasteBackFields();
    if (missing.length) {
      setRegisterError(
        `Please paste these CloudFormation Outputs first: ${missing.join(", ")}.`,
      );
      setValidation(null);
      return;
    }
    setRegistering(true);
    setRegisterError(null);
    setValidation(null);

    const payload = {
      aws_account_id: form.awsAccountId,
      alias: form.alias || `AWS ${form.awsAccountId}`,
      role_arn: form.roleArn,
      // Honor the Customize-step opt-in: if the user unchecked "Enable tag
      // writes" after pasting an ARN, don't silently re-enable it by sending
      // the stale value.
      tag_writer_role_arn: form.enableTagWrites ? form.tagWriterRoleArn || null : null,
      external_id: form.externalId,
      aws_access_key_id: form.awsAccessKeyId,
      aws_secret_access_key: form.awsSecretAccessKey,
      environment_label: "production",
      cur_s3_bucket: form.curBucketName,
      cur_s3_prefix: form.curPathPrefix,
      cur_report_name: form.curReportName,
      cur_managed_by_numio: isCreateNew,
    };

    try {
      let result;
      if (registered?.id) {
        // Already created on a prior attempt within this wizard session.
        // updateAccount re-runs validation server-side without 409.
        result = await updateAccount(registered.id, payload);
      } else {
        try {
          result = await registerAccount(payload);
        } catch (e) {
          // Account with this aws_account_id already exists (e.g. an aborted
          // prior attempt left a `disconnected` row). Look it up and fall back
          // to updateAccount so the user can re-validate without manual cleanup.
          const isConflict =
            /already registered/i.test(e.message || "") ||
            /\b409\b/.test(e.message || "");
          if (!isConflict) throw e;
          const list = await listAccounts();
          const existing = (list?.accounts || []).find(
            (a) => a.aws_account_id === payload.aws_account_id,
          );
          if (!existing) throw e;
          result = await updateAccount(existing.id, payload);
        }
      }
      setValidation(result.validation);
      setRegistered(result.account);
      if (onAccountRegistered) onAccountRegistered(result.account);
      if (result.validation?.overall_status === "connected") {
        // Account is registered — drop the in-progress record so a future
        // visit doesn't re-restore the wizard. Best-effort; if the DELETE
        // fails, the next resume will hit Verify, fall through to update +
        // re-validate, and try the cleanup again.
        try {
          await deleteOnboardingInProgress();
        } catch {
          /* swallow — self-healing on next visit */
        }
        persistedRef.current = false;
        goTo("success");
      }
    } catch (e) {
      // Some error paths embed the validation payload as JSON in the message.
      try {
        const parsed = JSON.parse(e.message);
        if (parsed?.validation) {
          setValidation(parsed.validation);
        } else {
          setRegisterError(e.message);
        }
      } catch {
        setRegisterError(e.message || "Registration failed");
      }
    } finally {
      setRegistering(false);
    }
  };

  // Single exit handler used by both the Intro step's "Back to methods"
  // button and the Cancel-onboarding affordance on every later step. When
  // persistence exists for this wizard session, we route through the
  // confirmation modal so the user is forced to acknowledge any deployed CFN
  // stack must be cleaned up manually. With no persistence (still on Intro
  // before Customize submit), we close out directly — there is no
  // server-side state to drop.
  const requestExit = () => {
    if (persistedRef.current) {
      setCancelOpen(true);
    } else if (onBack) {
      onBack();
    }
  };

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await deleteOnboardingInProgress();
      persistedRef.current = false;
      setCancelling(false);
      setCancelOpen(false);
      setCancelAck(false);
      if (onBack) onBack();
    } catch (e) {
      // Surface failure instead of swallowing — silent close would leave the
      // server record orphaned and auto-restore the wizard on next visit.
      // The user can retry by clicking Cancel onboarding again.
      const msg =
        e?.name === "AbortError"
          ? "Backend didn't respond in time. Retry, or Keep onboarding and try again later."
          : `Couldn't delete the in-progress record (${e?.message || "unknown error"}). Retry, or Keep onboarding and try again later.`;
      setCancelError(msg);
      setCancelling(false);
    }
  };

  const handleCancelDismiss = () => {
    setCancelOpen(false);
    setCancelAck(false);
    setCancelError(null);
  };

  const handleTriggerSync = async () => {
    setTriggering(true);
    try {
      await triggerJob("cur_ingestion");
      setTriggered(true);
    } catch {
      // Surface but do not block — the user can trigger from the Jobs page.
      setTriggered(true);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div
      className="p-4 rounded-lg border mb-4"
      style={{ borderColor: "var(--primary)", background: "var(--bg)" }}
      data-testid="onboarding-guided"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          Guided CloudFormation onboarding
        </p>
        {step !== "intro" && step !== "success" && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={requestExit}
            data-testid="guided-cancel-onboarding"
            style={{ color: "var(--danger, #dc2626)" }}
          >
            Cancel onboarding
          </button>
        )}
      </div>

      <StepBreadcrumb current={step} />

      {step === "intro" && (
        <div data-testid="guided-step-intro">
          <h3
            className="text-sm font-semibold mb-2"
            style={{ color: "var(--text)" }}
          >
            What happens next
          </h3>
          <ol
            className="text-xs mb-3 space-y-1"
            style={{ color: "var(--text-secondary)", paddingLeft: 18, listStyle: "decimal" }}
          >
            <li>You tell Numio your AWS region and the name of your CUR S3 bucket.</li>
            <li>Numio generates a CloudFormation template custom to your workspace.</li>
            <li>You run the template in the AWS Console — one click, ~2 minutes.</li>
            <li>You copy the CloudFormation Outputs back into Numio.</li>
            <li>Numio verifies the connection and starts reading cost data.</li>
          </ol>
          <div
            className="p-3 rounded-lg border mb-4 flex gap-2"
            style={{
              borderColor: "#d97706",
              background: "#fffbeb",
              color: "#78350f",
            }}
            role="note"
            aria-label="Prerequisites"
            data-testid="guided-intro-prerequisites"
          >
            <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
            <div className="text-sm">
              <p className="font-semibold mb-1">Prerequisite</p>
              <p>
                You need the <strong>AWS Console admin</strong> permission for
                your account — without it, the CloudFormation stack will fail
                to create the IAM role. You do <strong>not</strong> need the
                AWS CLI, IAM familiarity, or a pre-created role.
              </p>
            </div>
          </div>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            If you already created an IAM role and CUR export by hand, use{" "}
            <strong>Advanced</strong> from the method hub instead — it skips
            the CloudFormation step.
          </p>
          <div className="flex justify-between">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={requestExit}
              data-testid="guided-back-to-hub"
            >
              ← Back to methods
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => goTo("customize")}
              data-testid="guided-next-customize"
            >
              Start →
            </button>
          </div>
        </div>
      )}

      {step === "customize" && (
        <div data-testid="guided-step-customize">
          <p
            className="text-xs mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            These values end up pre-filled in the CloudFormation template and
            saved on the account record. You can change them later.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                className="text-xs block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                Instance label <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
              </label>
              <input
                className="formInput formInput--small w-full"
                value={form.label || ""}
                onChange={updateField("label")}
                placeholder="2604261950"
                aria-invalid={labelTouched && !labelValid}
                data-testid="guided-field-label"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
                data-testid="guided-field-label-help"
              >
                Embedded in the CloudFormation-managed IAM resource names
                (<code>NumioServiceUser-Cfn-&lt;label&gt;</code>,{" "}
                <code>NumioCurReaderRole-Cfn-&lt;label&gt;</code>), in the
                recommended stack name (<code>NumioConnect-&lt;label&gt;</code>),
                and as a tag on every managed resource. Two reasons it
                exists: (1) you can onboard several Numio instances into the
                same AWS account without IAM-name collisions; (2) an AWS
                admin can tell from the IAM console which Numio instance owns
                each resource. Format: lowercase letters, digits, and
                hyphens, 1–32 characters, must start with a letter or digit.
                The default is the current local time as{" "}
                <code>DDMMYYHHMM</code> — override it with anything more
                meaningful (a worktree name, your initials + date, a
                deployment tag) before continuing.
              </p>
              {labelTouched && !labelValid && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--danger, #dc2626)" }}
                  role="alert"
                  data-testid="guided-field-label-error"
                >
                  Label must match{" "}
                  <code>^[a-z0-9][a-z0-9-]&#123;0,31&#125;$</code>. Example:{" "}
                  <code>wkt-aws-onboarding</code>.
                </p>
              )}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                className="text-xs block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                Display name
              </label>
              <input
                className="formInput formInput--small w-full"
                value={form.alias}
                onChange={updateField("alias")}
                placeholder="Production Account"
                data-testid="guided-field-alias"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                A free-form name for this connection — shown in Numio's
                accounts list and dashboard pickers so you can tell several
                connected AWS accounts apart. Has no effect on AWS or CUR.
              </p>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                className="text-xs block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                CUR setup <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
              </label>
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="CUR setup"
                data-testid="guided-field-cur-mode"
              >
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="curMode"
                    value="create_new"
                    checked={isCreateNew}
                    onChange={() =>
                      setForm({ ...form, curMode: "create_new" })
                    }
                    data-testid="guided-cur-mode-create-new"
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text)" }}>
                      Create new (recommended)
                    </strong>
                    {" — "}Numio adds an S3 bucket and a daily CUR 2.0 export
                    to the same CloudFormation stack. Region locks to{" "}
                    <code>us-east-1</code>.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="curMode"
                    value="existing"
                    checked={!isCreateNew}
                    onChange={() =>
                      setForm({ ...form, curMode: "existing" })
                    }
                    data-testid="guided-cur-mode-existing"
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text)" }}>
                      Use existing CUR
                    </strong>
                    {" — "}Point Numio at a Cost and Usage Report you've
                    already set up. You'll enter the bucket, prefix, and
                    report name below.
                  </span>
                </label>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.enableTagWrites)}
                  onChange={(e) =>
                    setForm({ ...form, enableTagWrites: e.target.checked })
                  }
                  data-testid="guided-field-enable-tag-writes"
                  style={{ marginTop: 2 }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text)" }}>
                    Enable tag writes
                  </strong>
                  {" — "}also provision <code>NumioTagWriterRole</code> so Numio
                  can update tags on resources in this account. Adds tag-write
                  and AWS Organizations read permissions. Leave off to keep
                  Numio read-only; you can re-run onboarding later to enable it.
                </span>
              </label>
            </div>
            {!isCreateNew && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  AWS region <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.region}
                  onChange={updateField("region")}
                  placeholder="us-east-1"
                  data-testid="guided-field-region"
                />
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  The region where your CUR S3 bucket lives (usually us-east-1).
                </p>
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                className="text-xs block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                CUR S3 bucket name
              </label>
              <input
                className="formInput formInput--small w-full"
                value={form.curBucketName}
                onChange={updateField("curBucketName")}
                onBlur={handleCfnBlur("curBucketName")}
                aria-invalid={Boolean(cfnFieldErrors.curBucketName) || undefined}
                placeholder={
                  isCreateNew
                    ? curBucketNameFor(form.label) || "numio-cur-<label>"
                    : "acme-cur-exports"
                }
                data-testid="guided-field-bucket"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {isCreateNew
                  ? "Numio will create this S3 bucket. We pre-fill numio-cur-<label>; override only if that name is already taken in another AWS account globally."
                  : "The S3 bucket your Cost and Usage Report writes into. If you haven't set one up, leave this blank — the CloudFormation template runs without it and you can add the bucket later."}
              </p>
              {cfnFieldErrors.curBucketName ? (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--danger, #dc2626)" }}
                  role="alert"
                  data-testid="guided-field-bucket-error"
                >
                  {cfnFieldErrors.curBucketName}
                </p>
              ) : (
                <EmbeddedSpaceWarning value={form.curBucketName} />
              )}
            </div>
            <div>
              <label
                className="text-xs block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                CUR path prefix
              </label>
              <input
                className="formInput formInput--small w-full"
                value={form.curPathPrefix}
                onChange={updateField("curPathPrefix")}
                onBlur={handleCfnBlur("curPathPrefix")}
                aria-invalid={Boolean(cfnFieldErrors.curPathPrefix) || undefined}
                placeholder={isCreateNew ? CREATE_NEW_PATH_PREFIX : "cur"}
                data-testid="guided-field-prefix"
              />
              {cfnFieldErrors.curPathPrefix ? (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--danger, #dc2626)" }}
                  role="alert"
                  data-testid="guided-field-prefix-error"
                >
                  {cfnFieldErrors.curPathPrefix}
                </p>
              ) : (
                <EmbeddedSpaceWarning value={form.curPathPrefix} />
              )}
            </div>
            <div>
              <label
                className="text-xs block mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                CUR report name
              </label>
              <input
                className="formInput formInput--small w-full"
                value={form.curReportName}
                onChange={updateField("curReportName")}
                onBlur={handleCfnBlur("curReportName")}
                aria-invalid={Boolean(cfnFieldErrors.curReportName) || undefined}
                placeholder={
                  isCreateNew
                    ? curReportNameFor(form.label) || "numio-cur-<label>"
                    : "my-cost-report"
                }
                data-testid="guided-field-report"
              />
              {cfnFieldErrors.curReportName ? (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--danger, #dc2626)" }}
                  role="alert"
                  data-testid="guided-field-report-error"
                >
                  {cfnFieldErrors.curReportName}
                </p>
              ) : (
                <EmbeddedSpaceWarning value={form.curReportName} />
              )}
            </div>
          </div>
          <div className="flex justify-between mt-4">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => goTo("intro")}
              data-testid="guided-back-intro"
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => goTo("apply")}
              disabled={!effectiveRegion || !labelValid || !cfnFieldsValid}
              data-testid="guided-next-apply"
            >
              Generate template →
            </button>
          </div>
        </div>
      )}

      {step === "apply" && (
        <div data-testid="guided-step-apply">
          {cfnLoading && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Generating template…
            </p>
          )}
          {cfnError && (
            <p
              className="text-xs"
              style={{ color: "var(--danger, #dc2626)" }}
              role="alert"
            >
              {cfnError}
            </p>
          )}
          {cfn && (
            <>
              <p
                className="text-xs mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Your CloudFormation template is ready. Pick one of:
              </p>
              <ol
                className="text-xs space-y-3 mb-4"
                style={{ color: "var(--text-secondary)", paddingLeft: 18, listStyle: "decimal" }}
              >
                <li>
                  <strong>Launch in AWS Console</strong> — opens
                  CloudFormation in region <code>{cfn.region}</code>.
                  {cfn.launch_mode === "upload" && (
                    <>
                      {" "}Choose <em>Upload a template file</em> and upload
                      the file you download below.
                    </>
                  )}
                  <div className="mt-2">
                    <a
                      href={cfn.launch_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--primary btn--sm"
                      data-testid="guided-launch-url"
                    >
                      Open CloudFormation in AWS Console ↗
                    </a>
                  </div>
                </li>
                <li>
                  <strong>Download the template</strong> — save and upload it
                  manually, or hand it to a colleague.
                  <div className="mt-2">
                    <a
                      href={getCfnTemplateDownloadUrl({
                        label: form.label,
                        region: effectiveRegion,
                        curMode: form.curMode || "create_new",
                        curBucketName: form.curBucketName,
                        curReportName: form.curReportName,
                        curPathPrefix: form.curPathPrefix,
                        enableTagWrites: form.enableTagWrites,
                      })}
                      download={`${cfn.stack_name}.yaml`}
                      className="btn btn--primary btn--sm"
                      data-testid="guided-download-url"
                    >
                      Download {cfn.stack_name}.yaml
                    </a>
                  </div>
                </li>
                <li>
                  <strong>Copy-paste fallback</strong> — paste the template
                  body directly into the CloudFormation console.
                  <details
                    style={{ marginTop: 8 }}
                    data-testid="guided-template-details"
                  >
                    <summary
                      className="text-xs cursor-pointer"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Show template body
                    </summary>
                    <pre
                      style={{
                        marginTop: 8,
                        padding: 12,
                        background: "var(--bg-inset)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 10,
                        maxHeight: 240,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        color: "var(--text)",
                      }}
                    >
                      {cfn.template_body}
                    </pre>
                  </details>
                </li>
              </ol>
              <div
                className="p-3 rounded-lg border mb-3"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-inset)",
                }}
                data-testid="guided-cfn-walkthrough"
              >
                <p
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  In the AWS CloudFormation Console
                </p>
                <ol
                  className="text-xs space-y-2"
                  style={{
                    color: "var(--text-secondary)",
                    paddingLeft: 18,
                    listStyle: "decimal",
                  }}
                >
                  <li>
                    <strong>Create stack</strong> — choose{" "}
                    <em>Upload a template file</em> and upload{" "}
                    <code>{cfn.stack_name}.yaml</code> from the download above.
                    {cfn.launch_mode !== "upload" && (
                      <>
                        {" "}If you used <em>Open CloudFormation in AWS
                        Console</em>, the template is already pre-loaded — skip
                        to the next page.
                      </>
                    )}
                  </li>
                  <li>
                    <strong>Specify stack details</strong> — give the stack a
                    name. Suggested:{" "}
                    <code>{cfn.stack_name}</code>. Leave the parameters at
                    their pre-filled values.
                  </li>
                  <li>
                    <strong>Configure stack options</strong> — accept the
                    defaults. At the bottom, tick{" "}
                    <em>I acknowledge that AWS CloudFormation might create
                    IAM resources with custom names</em>{" "}
                    (<code>CAPABILITY_NAMED_IAM</code>) and click <em>Next</em>.
                  </li>
                  <li>
                    <strong>Review and create</strong> — scroll to the bottom
                    and click <em>Submit</em> (also labelled{" "}
                    <em>Create stack</em>).
                  </li>
                  <li>
                    <strong>Wait</strong> — the stack reaches{" "}
                    <strong>CREATE_COMPLETE</strong> in about 2 minutes. Then
                    return here.
                  </li>
                </ol>
              </div>
            </>
          )}
          <div className="flex justify-between mt-4">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => goTo("customize")}
              data-testid="guided-back-customize"
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => goTo("waiting")}
              disabled={!cfn}
              data-testid="guided-next-waiting"
            >
              I applied the stack →
            </button>
          </div>
        </div>
      )}

      {step === "waiting" && (
        <div data-testid="guided-step-waiting">
          <p
            className="text-xs mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Open the CloudFormation console and wait for the stack named{" "}
            <code>{cfn?.stack_name}</code> to reach{" "}
            <strong>CREATE_COMPLETE</strong> (usually under 2 minutes). Then
            open the <strong>Outputs</strong> tab and copy each value into the
            fields below.
          </p>
          <div
            className="p-3 rounded-lg border text-xs mb-3"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-inset)",
            }}
          >
            <p
              className="font-semibold mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Paste CloudFormation Outputs here
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  AwsAccountId <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.awsAccountId}
                  onChange={updateField("awsAccountId")}
                  placeholder="123456789012"
                  aria-invalid={
                    Boolean(registerError) && !form.awsAccountId
                      ? "true"
                      : undefined
                  }
                  data-testid="guided-field-account-id"
                  style={{ background: "var(--bg)" }}
                />
                <EmbeddedSpaceWarning value={form.awsAccountId} />
              </div>
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  RoleArn <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.roleArn}
                  onChange={updateField("roleArn")}
                  placeholder="arn:aws:iam::123456789012:role/numio/NumioCurReaderRole"
                  aria-invalid={
                    Boolean(registerError) && !form.roleArn ? "true" : undefined
                  }
                  data-testid="guided-field-role-arn"
                  style={{ background: "var(--bg)" }}
                />
                <EmbeddedSpaceWarning value={form.roleArn} />
              </div>
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  AccessKeyId <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.awsAccessKeyId}
                  onChange={updateField("awsAccessKeyId")}
                  placeholder="AKIA..."
                  data-testid="guided-field-access-key"
                  style={{ background: "var(--bg)" }}
                />
              </div>
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  SecretAccessKey <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  type="password"
                  value={form.awsSecretAccessKey}
                  onChange={updateField("awsSecretAccessKey")}
                  placeholder="CloudFormation output value"
                  data-testid="guided-field-secret"
                />
              </div>
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  ExternalId <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.externalId}
                  onChange={updateField("externalId")}
                  placeholder="Same as shown in the Outputs tab"
                  data-testid="guided-field-external-id"
                />
              </div>
            </div>
          </div>
          {registerError && step === "waiting" && (
            <p
              className="text-xs mb-2"
              style={{ color: "var(--danger, #dc2626)" }}
              role="alert"
              data-testid="guided-waiting-error"
            >
              {registerError}
            </p>
          )}
          <div className="flex justify-between mt-4">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => goTo("apply")}
              data-testid="guided-back-apply"
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                const missing = missingPasteBackFields();
                if (missing.length) {
                  setRegisterError(
                    `Please paste these CloudFormation Outputs first: ${missing.join(", ")}.`,
                  );
                  return;
                }
                setRegisterError(null);
                goTo("verify");
                handleVerify();
              }}
              data-testid="guided-next-verify"
            >
              Verify connection →
            </button>
          </div>
        </div>
      )}

      {step === "verify" && (
        <div ref={verifyRef} data-testid="guided-step-verify">
          <p
            className="text-xs mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Confirm the values below match the CloudFormation Outputs and click
            Validate. If a check fails, edit the value and try again — your
            entries stay in place.
          </p>
          <div
            className="p-3 rounded-lg border text-xs mb-3"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-inset)",
            }}
          >
            <p
              className="font-semibold mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Paste CloudFormation Outputs here
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  AwsAccountId{" "}
                  <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.awsAccountId}
                  onChange={updateField("awsAccountId")}
                  disabled={registering}
                  placeholder="123456789012"
                  data-testid="guided-verify-field-account-id"
                />
                <EmbeddedSpaceWarning value={form.awsAccountId} />
              </div>
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  RoleArn{" "}
                  <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.roleArn}
                  onChange={updateField("roleArn")}
                  disabled={registering}
                  placeholder="arn:aws:iam::123456789012:role/numio/NumioCurReaderRole"
                  data-testid="guided-verify-field-role-arn"
                />
                <EmbeddedSpaceWarning value={form.roleArn} />
              </div>
              {form.enableTagWrites && (
                <div>
                  <label
                    className="text-xs block mb-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    TagWriterRoleArn
                  </label>
                  <input
                    className="formInput formInput--small w-full"
                    value={form.tagWriterRoleArn}
                    onChange={updateField("tagWriterRoleArn")}
                    disabled={registering}
                    placeholder="arn:aws:iam::123456789012:role/numio/NumioTagWriterRole-Cfn-..."
                    data-testid="guided-verify-field-tag-writer-role-arn"
                  />
                  <EmbeddedSpaceWarning value={form.tagWriterRoleArn} />
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Paste the <code>TagWriterRoleArn</code> stack output to enable
                    tag writes. Verified by the tag-writer check.
                  </p>
                </div>
              )}
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  AccessKeyId{" "}
                  <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.awsAccessKeyId}
                  onChange={updateField("awsAccessKeyId")}
                  disabled={registering}
                  placeholder="AKIA..."
                  data-testid="guided-verify-field-access-key"
                />
              </div>
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  SecretAccessKey{" "}
                  <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  type="password"
                  value={form.awsSecretAccessKey}
                  onChange={updateField("awsSecretAccessKey")}
                  disabled={registering}
                  placeholder="CloudFormation output value"
                  data-testid="guided-verify-field-secret"
                />
              </div>
              <div>
                <label
                  className="text-xs block mb-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  ExternalId{" "}
                  <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
                </label>
                <input
                  className="formInput formInput--small w-full"
                  value={form.externalId}
                  onChange={updateField("externalId")}
                  disabled={registering}
                  placeholder="Same as shown in the Outputs tab"
                  data-testid="guided-verify-field-external-id"
                />
              </div>
            </div>
          </div>

          {registerError && (
            <p
              className="text-xs mb-2"
              style={{ color: "var(--danger, #dc2626)" }}
              role="alert"
              data-testid="guided-verify-error"
            >
              {registerError}
            </p>
          )}

          <ValidationSteps
            validation={
              registering && !validation ? PENDING_VALIDATION : validation
            }
            title="Verification results"
            testId="guided-validation-steps"
            stepTestIdPrefix="guided-step-"
          />

          <div className="flex justify-between mt-4">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => goTo("waiting")}
              disabled={registering}
              data-testid="guided-back-waiting"
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleVerify}
              disabled={registering}
              data-testid="guided-retry-verify"
              aria-busy={registering ? "true" : "false"}
            >
              {registering
                ? "Validating…"
                : validation
                ? "Validate again"
                : "Validate connection"}
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div data-testid="guided-step-success">
          <p
            className="text-sm font-semibold mb-2"
            style={{ color: "var(--success, #059669)" }}
          >
            ✅ Connected.
          </p>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            {registered?.alias || "Your AWS account"} is now reading cost data
            through the role you created.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                if (onDone) onDone(registered);
              }}
              data-testid="guided-close"
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleTriggerSync}
              disabled={triggering || triggered}
              data-testid="guided-trigger-sync"
            >
              {triggered
                ? "First sync queued"
                : triggering
                ? "Starting…"
                : "Trigger first sync"}
            </button>
          </div>
          {triggered && (
            <p
              className="text-xs mt-3"
              style={{ color: "var(--text-muted)" }}
            >
              The first ingestion run is queued. Open <em>Settings →
              Integrations → Jobs</em> to watch it land.
            </p>
          )}
        </div>
      )}

      {cancelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guided-cancel-modal-title"
          data-testid="guided-cancel-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            className="rounded-lg border"
            style={{
              maxWidth: 480,
              width: "calc(100% - 32px)",
              background: "var(--bg)",
              borderColor: "var(--border)",
              padding: 20,
            }}
          >
            <h3
              id="guided-cancel-modal-title"
              className="text-sm font-semibold mb-2"
              style={{ color: "var(--text)" }}
            >
              Cancel onboarding?
            </h3>
            <p
              className="text-xs mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              You are about to discard the in-progress wizard state for this
              workspace. Any CloudFormation stack you already deployed in your
              AWS account will <strong>not</strong> be removed by Numio — you
              must delete it yourself in the AWS Console (CloudFormation →
              your <code>NumioConnect-…</code> stack → Delete) before
              confirming below.
            </p>
            <label
              className="flex items-start gap-2 text-xs mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              <input
                type="checkbox"
                checked={cancelAck}
                onChange={(e) => setCancelAck(e.target.checked)}
                data-testid="guided-cancel-ack"
                style={{ marginTop: 2 }}
              />
              <span>I have deleted the CFN stack in AWS Console.</span>
            </label>
            {cancelError && (
              <p
                className="text-xs mb-3"
                role="alert"
                data-testid="guided-cancel-error"
                style={{ color: "var(--danger, #dc2626)" }}
              >
                {cancelError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={handleCancelDismiss}
                disabled={cancelling}
                data-testid="guided-cancel-dismiss"
              >
                Keep onboarding
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={handleCancelConfirm}
                disabled={!cancelAck || cancelling}
                data-testid="guided-cancel-confirm"
                style={{
                  background: "var(--danger, #dc2626)",
                  color: "#fff",
                  opacity: !cancelAck || cancelling ? 0.5 : 1,
                }}
              >
                {cancelling ? "Cancelling…" : "Cancel onboarding"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
