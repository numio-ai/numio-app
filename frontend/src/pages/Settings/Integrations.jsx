import React, { useEffect, useState, useCallback } from "react";
import { FaAws } from "react-icons/fa6";
import { SiGooglecloud } from "react-icons/si";
import { IconCloud } from "../../components/Icons";
import {
  listAccounts, registerAccount, updateAccount,
  revalidateAccount, deactivateAccount, deleteAccount,
  getWorkspaceInfo,
} from "../../api/workspace";
import {
  getOnboardingFeatures,
  getOnboardingInProgress,
} from "../../api/onboarding";
import OnboardingMethodHub from "../../components/onboarding/OnboardingMethodHub";
import GuidedOnboarding from "../../components/onboarding/GuidedOnboarding";
import ChatOnboarding from "../../components/onboarding/ChatOnboarding";
import {
  StatusDot,
  ValidationSteps,
  STATUS_COLORS,
} from "../../components/onboarding/ValidationSteps";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";
import { validateCfnField } from "../../components/onboarding/cfnValidation";

const EMPTY_FORM = {
  aws_access_key_id: "", aws_secret_access_key: "", aws_account_id: "",
  role_arn: "", external_id: "", alias: "",
  cur_s3_bucket: "", cur_s3_prefix: "", cur_report_name: "",
};

function StatusBadge({ status, statusMessage }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS.inactive;
  return (
    <span className="flex items-center gap-1.5">
      <StatusDot status={status} />
      <span
        className="text-xs font-medium px-2 py-1 rounded-full cursor-default"
        style={{ background: style.bg, color: style.color }}
        title={statusMessage || ""}
      >
        {status}
      </span>
    </span>
  );
}


// ---------------------------------------------------------------------------
// Account form (shared between Add and Edit)
// ---------------------------------------------------------------------------

const hasEmbeddedSpace = (v) => typeof v === "string" && /\s/.test(v.trim());

function AccountFormDialog({ mode = "edit", form, setForm, onSubmit, onCancel, onBack, backLabel, submitting, submitLabel, validation, title, subtitle }) {
  // CUR fields validated against the CloudFormation AllowedPattern constraints
  // before the account is registered. Errors appear on blur and clear on a
  // becoming-valid edit.
  const [cfnFieldErrors, setCfnFieldErrors] = useState({});

  const updateField = (field, cfnKind) => (e) => {
    const trimmed = e.target.value.trim();
    setForm({ ...form, [field]: trimmed });
    if (cfnKind && cfnFieldErrors[field]) {
      const err = validateCfnField(cfnKind, trimmed);
      if (!err) {
        setCfnFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  };

  const handleCfnBlur = (field, cfnKind) => (e) => {
    // Read straight from the DOM rather than the closed-over `form` state,
    // because a change event firing immediately before this blur may not
    // have committed yet — closure would see the prior value.
    const value = (e?.target?.value ?? form[field] ?? "").trim();
    const err = validateCfnField(cfnKind, value);
    setCfnFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const [showCur, setShowCur] = useState(
    mode === "add" ||
      Boolean(form.cur_s3_bucket || form.cur_s3_prefix || form.cur_report_name)
  );

  const credentialFields = [
    { key: "aws_access_key_id", label: "AWS Access Key ID", placeholder: "AKIA...", required: true },
    { key: "aws_secret_access_key", label: "AWS Secret Access Key", placeholder: "Secret key", type: "password", required: true },
  ];

  const accountFields = [
    { key: "aws_account_id", label: "AWS Account ID", placeholder: "123456789012", required: true },
    {
      key: "role_arn",
      label: "Role ARN",
      placeholder: "arn:aws:iam::123456789012:role/NumioCurReaderRole",
      colSpan: 2,
      required: true,
      helper:
        "The IAM role in your AWS account that trusts numio-service and grants Numio read access to your CUR. You created this when running the onboarding CloudFormation stack — copy its ARN from the stack's Outputs (or from IAM → Roles).",
    },
    {
      key: "external_id",
      label: "External ID",
      placeholder: "UUID from trust policy",
      required: true,
      helper:
        "Prefilled with this workspace's ExternalId. If you already created the IAM role yourself, confirm it matches the sts:ExternalId condition in the role's trust policy (IAM → Roles → your role → Trust relationships). A mismatch causes an opaque AccessDenied at validation.",
    },
    { key: "alias", label: "Display Name", placeholder: "Production Account (optional)" },
  ];

  const curFields = [
    { key: "cur_s3_bucket", label: "S3 Bucket", placeholder: "acme-cur-exports", cfnKind: "bucket" },
    { key: "cur_s3_prefix", label: "S3 Prefix", placeholder: "daily/MyCostExport/data", cfnKind: "prefix" },
    { key: "cur_report_name", label: "Report Name", placeholder: "MyCostExport", cfnKind: "report" },
  ];

  // Computed from current values, not from cfnFieldErrors, so submit stays
  // disabled even if a value was changed without losing focus first.
  const cfnFieldsValid = curFields.every(
    (f) => !validateCfnField(f.cfnKind, form[f.key]),
  );

  const renderField = (f) => {
    const cfnError = f.cfnKind ? cfnFieldErrors[f.key] : null;
    return (
      <div key={f.key} style={f.colSpan === 2 ? { gridColumn: "1 / -1" } : {}}>
        <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>
          {f.label}{f.required && <span style={{ color: "var(--danger, #dc2626)" }}> *</span>}
        </label>
        {f.type === "select" ? (
          <select
            className="formInput formInput--small w-full"
            value={form[f.key]} onChange={updateField(f.key)}
            style={{ borderColor: "var(--border)" }}
          >
            {f.options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        ) : (
          <input
            className="formInput formInput--small w-full"
            type={f.type || "text"}
            value={form[f.key]}
            onChange={updateField(f.key, f.cfnKind)}
            onBlur={f.cfnKind ? handleCfnBlur(f.key, f.cfnKind) : undefined}
            aria-invalid={cfnError ? true : undefined}
            placeholder={f.placeholder}
            style={{ borderColor: "var(--border)" }}
            data-testid={`account-field-${f.key}`}
          />
        )}
        {f.helper && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {f.helper}
          </p>
        )}
        {cfnError ? (
          <p
            className="text-xs mt-1"
            style={{ color: "var(--danger, #dc2626)" }}
            role="alert"
            data-testid={`account-field-${f.key}-error`}
          >
            {cfnError}
          </p>
        ) : (
          hasEmbeddedSpace(form[f.key]) && (
            <p className="text-xs mt-1" style={{ color: "var(--danger, #dc2626)" }}>
              This value contains a space — AWS identifiers do not allow spaces.
            </p>
          )
        )}
      </div>
    );
  };

  return (
    <div className="p-4 rounded-lg border mb-4" style={{ borderColor: "var(--primary)", background: "var(--bg)" }}>
      {(title || onBack) && (
        <div className="flex items-center justify-between mb-2">
          {title && <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{title}</p>}
          {onBack && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onBack}
              data-testid="advanced-back-to-guided"
            >
              ← {backLabel || "Back to Guided"}
            </button>
          )}
        </div>
      )}
      {subtitle && (
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      )}

      {/* Numio Service Credentials */}
      <fieldset className="mb-4 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-inset)" }}>
        <legend className="text-xs font-semibold px-1" style={{ color: "var(--text-secondary)" }}>
          Numio Service Credentials
        </legend>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Access key and secret for the <code>numio-service</code> IAM user that will assume the customer role.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {credentialFields.map(renderField)}
        </div>
      </fieldset>

      {/* Account Details */}
      <fieldset className="mb-4 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-inset)" }}>
        <legend className="text-xs font-semibold px-1" style={{ color: "var(--text-secondary)" }}>
          Account Details
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accountFields.map(renderField)}
        </div>
      </fieldset>

      {/* CUR Configuration (collapsible) */}
      <fieldset className="mb-3 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-inset)" }}>
        <legend className="text-xs font-semibold px-1" style={{ color: "var(--text-secondary)" }}>
          <button
            type="button" onClick={() => setShowCur(!showCur)}
            className="btn btn--ghost" style={{ padding: 0, minWidth: 0, fontSize: 12, color: "var(--text-secondary)" }}
          >
            {showCur ? "\u25BC" : "\u25B6"} CUR Configuration
          </button>
        </legend>
        {!showCur && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Required for cost data access. You can enter these details now or add them later.
          </p>
        )}
        {showCur && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {curFields.map(renderField)}
          </div>
        )}
      </fieldset>

      {validation && <ValidationSteps validation={validation} />}

      <div className="flex justify-end gap-2 mt-3">
        {onCancel && (
          <button className="btn btn--ghost btn--sm" onClick={onCancel} disabled={submitting}>Cancel</button>
        )}
        <button
          className="btn btn--primary btn--sm"
          onClick={onSubmit}
          disabled={submitting || !cfnFieldsValid}
          data-testid="account-form-submit"
        >
          {submitting ? "Validating..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Integrations() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add account state — hub picker → method-specific panels.
  // `addMethod` transitions: null (closed) → 'hub' → 'guided' | 'chat' | 'advanced' → back to 'hub'.
  const [addMethod, setAddMethod] = useState(null);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM }); // Advanced form
  const [guidedForm, setGuidedForm] = useState({ region: "us-east-1" });
  const [chatForm, setChatForm] = useState({ region: "us-east-1" });
  const [adding, setAdding] = useState(false);
  const [addValidation, setAddValidation] = useState(null);

  // Step the Guided wizard should mount at — null means "use the default
  // (Intro)". Set by the auto-restore effect when the backend reports an
  // in-progress record for this workspace.
  const [guidedInitialStep, setGuidedInitialStep] = useState(null);

  // Server-side onboarding feature flags.
  const [chatEnabled, setChatEnabled] = useState(false);

  // Workspace's own ExternalId — fetched once on mount and prefilled into the
  // Add Account forms (Guided wizard + Advanced) so the operator does not have
  // to copy/paste the UUID back from CloudFormation. `prefillApplied` is the
  // per-Add-session guard: prefill happens once when the Add dialog opens and
  // is never re-applied while the same session stays open, so a value the user
  // typed (or cleared) survives method-switch / step-back / re-render.
  const [workspaceExternalId, setWorkspaceExternalId] = useState(null);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // Edit account state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [editValidation, setEditValidation] = useState(null);

  // Revalidate state
  const [revalidatingId, setRevalidatingId] = useState(null);
  const [revalidateResult, setRevalidateResult] = useState(null);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await listAccounts();
      setAccounts(data.accounts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  useEffect(() => {
    // Non-fatal: if the features endpoint fails we simply hide Chat.
    getOnboardingFeatures()
      .then((f) => setChatEnabled(Boolean(f?.chat_enabled)))
      .catch(() => setChatEnabled(false));
  }, []);

  useEffect(() => {
    // Non-fatal: if the workspace endpoint fails the External ID field falls
    // back to today's empty default and the operator pastes manually.
    getWorkspaceInfo()
      .then((info) => setWorkspaceExternalId(info?.external_id || null))
      .catch(() => setWorkspaceExternalId(null));
  }, []);

  useEffect(() => {
    // Auto-restore an in-progress Guided onboarding for this workspace.
    // Failing softly — a network hiccup just means the wizard stays closed
    // and the user can re-open Add Account manually.
    getOnboardingInProgress()
      .then((row) => {
        if (!row || !row.step) return;
        setGuidedForm((f) => ({ ...f, label: row.label || f.label }));
        setGuidedInitialStep(row.step);
        setAddMethod("guided");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Apply the prefill exactly once per Add session, the moment both
    // (a) the dialog is open and (b) the workspace ExternalId is loaded.
    // The empty-check guard preserves any value the user already typed before
    // the API resolved.
    if (!workspaceExternalId || !addMethod || prefillApplied) return;
    setAddForm((f) =>
      f.external_id ? f : { ...f, external_id: workspaceExternalId },
    );
    setGuidedForm((f) =>
      f.externalId ? f : { ...f, externalId: workspaceExternalId },
    );
    setPrefillApplied(true);
  }, [workspaceExternalId, addMethod, prefillApplied]);

  // -- Add --
  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    setAddValidation(null);
    try {
      const result = await registerAccount(addForm);
      await loadAccounts();
      if (result.validation?.overall_status === "disconnected") {
        setAddValidation(result.validation);
      } else {
        closeAdd();
      }
    } catch (e) {
      const parsed = tryParseValidation(e.message);
      if (parsed) {
        setAddValidation(parsed);
      } else {
        setError(e.message);
      }
    } finally {
      setAdding(false);
    }
  };

  const closeAdd = () => {
    setAddMethod(null);
    setAddForm({ ...EMPTY_FORM });
    setGuidedForm({ region: "us-east-1" });
    setChatForm({ region: "us-east-1" });
    setAddValidation(null);
    setPrefillApplied(false);
    setGuidedInitialStep(null);
  };

  // Back-to-hub from any method — keep method-specific form state intact.
  // Always clear guidedInitialStep: post-cancel the server record is gone, so
  // a stale value here would auto-restore the wizard at a deleted step on
  // next entry. Safe for the intro-step "Back to methods" path because that
  // path is only reachable when guidedInitialStep is already null.
  const backToHub = () => {
    setAddMethod("hub");
    setAddValidation(null);
    setGuidedInitialStep(null);
  };

  const openHub = () => {
    setAddMethod(addMethod ? null : "hub");
    setAddValidation(null);
  };

  // -- Edit --
  const startEdit = (a) => {
    setEditingId(a.id);
    const maskedKey = a.aws_access_key_id_hint ? `\u2022\u2022\u2022\u2022${a.aws_access_key_id_hint}` : "";
    const maskedSecret = a.aws_access_key_id_hint ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "";
    setEditForm({
      aws_account_id: a.aws_account_id || "",
      alias: a.alias || "",
      role_arn: a.role_arn || "", external_id: a.external_id || "",
      aws_access_key_id: maskedKey, aws_secret_access_key: maskedSecret,
      cur_s3_bucket: a.cur_s3_bucket || "", cur_s3_prefix: a.cur_s3_prefix || "",
      cur_report_name: a.cur_report_name || "",
    });
    setEditValidation(null);
    setRevalidateResult(null);
  };

  const handleEdit = async () => {
    setEditing(true);
    setError(null);
    setEditValidation(null);
    try {
      // Only send fields with real values; skip empty, masked, and internal fields
      const payload = {};
      for (const [k, v] of Object.entries(editForm)) {
        if (k.startsWith("_")) continue;
        if (v === "") continue;
        if (typeof v === "string" && v.startsWith("\u2022")) continue;
        payload[k] = v;
      }
      const result = await updateAccount(editingId, payload);
      await loadAccounts();
      if (result.validation?.overall_status === "disconnected") {
        setEditValidation(result.validation);
      } else {
        setEditingId(null);
        setEditValidation(null);
      }
    } catch (e) {
      const parsed = tryParseValidation(e.message);
      if (parsed) {
        setEditValidation(parsed);
      } else {
        setError(e.message);
      }
    } finally {
      setEditing(false);
    }
  };

  // -- Revalidate --
  const handleRevalidate = async (id) => {
    setRevalidatingId(id);
    setRevalidateResult(null);
    try {
      const result = await revalidateAccount(id);
      setRevalidateResult({ id, validation: result.validation });
      await loadAccounts();
    } catch (e) {
      setError(e.message);
    } finally {
      setRevalidatingId(null);
    }
  };

  // -- Deactivate --
  const handleDeactivate = async (id) => {
    if (!window.confirm("Deactivate this account? It will stop syncing data but can be reactivated later.")) return;
    try {
      await deactivateAccount(id);
      await loadAccounts();
    } catch (e) {
      setError(e.message);
    }
  };

  // -- Delete (permanent) --
  const handleDelete = async (id) => {
    if (!window.confirm(
      "PERMANENTLY DELETE this account?\n\n" +
      "This action cannot be undone. The account and all associated data will be removed from the system."
    )) return;
    try {
      await deleteAccount(id);
      await loadAccounts();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="pageContent settings-page-content">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Integrations</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Connect your AWS accounts so Numio can read cost data from CUR exports in S3.
        </p>
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>{error}</p>}

      <section
        className={execCardClass}
        style={{ marginBottom: 24, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
      >
        <div className="flex justify-between items-center mb-4">
          <p className={execHeaderClass} style={{ marginBottom: 0 }}>AWS ACCOUNTS</p>
          <button
            className="btn btn--primary btn--sm"
            onClick={openHub}
            data-testid="add-account-button"
          >
            + Add Account
          </button>
        </div>

        {addMethod === "hub" && (
          <OnboardingMethodHub
            chatEnabled={chatEnabled}
            onSelect={(m) => setAddMethod(m)}
            onCancel={closeAdd}
          />
        )}

        {addMethod === "guided" && (
          <GuidedOnboarding
            form={guidedForm}
            setForm={setGuidedForm}
            initialStep={guidedInitialStep}
            onBack={backToHub}
            onAccountRegistered={loadAccounts}
            onDone={async () => {
              await loadAccounts();
              closeAdd();
            }}
          />
        )}

        {addMethod === "chat" && chatEnabled && (
          <ChatOnboarding
            form={chatForm}
            setForm={setChatForm}
            onBack={backToHub}
            onAccountRegistered={loadAccounts}
            onDone={async () => {
              await loadAccounts();
              closeAdd();
            }}
          />
        )}

        {addMethod === "advanced" && (
          <AccountFormDialog
            mode="add"
            form={addForm} setForm={setAddForm}
            onSubmit={handleAdd} onCancel={closeAdd}
            onBack={() => setAddMethod("guided")}
            backLabel="Back to Guided"
            submitting={adding} submitLabel="Add Account"
            validation={addValidation}
            title="Advanced: paste existing IAM and CUR details"
            subtitle="For users comfortable with IAM roles, S3 bucket policies, and CUR exports. Every field maps 1:1 to AWS — no auto-setup. If you haven't created the IAM role or CUR export yet, use Guided instead."
          />
        )}

        {loading ? (
          <p className="text-sm py-4" style={{ color: "var(--text-tertiary)" }}>Loading accounts...</p>
        ) : accounts.length === 0 && !addMethod ? (
          <p className="text-sm py-4" style={{ color: "var(--text-tertiary)" }}>
            No AWS accounts connected. Add an account to start tracking costs.
          </p>
        ) : accounts.length > 0 && (
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-inset)", borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>ACCOUNT</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>ID</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>STATUS</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-tertiary)", fontSize: 11 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <React.Fragment key={a.id}>
                    <tr style={{ borderBottom: "1px solid var(--border)", opacity: a.status === "inactive" ? 0.5 : 1 }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FaAws size={16} style={{ color: "var(--text)" }} />
                          <span style={{ color: "var(--text)" }}>{a.alias || a.aws_account_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs" style={{ color: "var(--text-secondary)" }}>{a.aws_account_id}</code>
                        {a.aws_access_key_id_hint && (
                          <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                            key: {a.aws_access_key_id_hint}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} statusMessage={a.status_message} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="btn btn--ghost btn--sm" onClick={() => startEdit(a)} style={{ color: "var(--primary)" }}>
                            Edit
                          </button>
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => handleRevalidate(a.id)}
                            disabled={revalidatingId === a.id}
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {revalidatingId === a.id ? "Checking..." : "Validate"}
                          </button>
                          {a.status !== "inactive" && (
                            <button className="btn btn--ghost btn--sm" style={{ color: "var(--text-tertiary)" }} onClick={() => handleDeactivate(a.id)}>
                              Deactivate
                            </button>
                          )}
                          <button className="btn btn--ghost btn--sm" style={{ color: "var(--danger)" }} onClick={() => handleDelete(a.id)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Status message row */}
                    {a.status_message && a.status !== "connected" && (
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td colSpan={4} className="px-4 py-2">
                          <p className="text-xs" style={{ color: a.status === "incomplete" ? "#d97706" : "var(--danger)" }}>
                            {a.status_message}
                          </p>
                        </td>
                      </tr>
                    )}
                    {/* Inline revalidation results */}
                    {revalidateResult?.id === a.id && (
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td colSpan={4} className="px-4 py-2">
                          <ValidationSteps validation={revalidateResult.validation} />
                          <div className="flex justify-end mt-2">
                            <button className="btn btn--ghost btn--sm" onClick={() => setRevalidateResult(null)}>
                              Dismiss
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* Inline edit form */}
                    {editingId === a.id && (
                      <tr>
                        <td colSpan={4} className="px-4 py-2">
                          <AccountFormDialog
                            form={editForm} setForm={setEditForm}
                            onSubmit={handleEdit}
                            onCancel={() => { setEditingId(null); setEditValidation(null); }}
                            submitting={editing} submitLabel="Save & Validate"
                            validation={editValidation} title={`Edit: ${a.alias || a.aws_account_id}`}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className={execCardClass}
        style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
      >
        <p className={execHeaderClass}>OTHER INTEGRATIONS</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "Google Cloud", Icon: SiGooglecloud },
            { name: "Azure", Icon: IconCloud },
            { name: "Oracle Cloud", Icon: IconCloud },
          ].map((p) => (
            <div
              key={p.name}
              className="flex flex-col items-center justify-center py-6 rounded-lg border"
              style={{ borderColor: "var(--border)", background: "var(--bg-inset)" }}
            >
              {p.Icon && <p.Icon size={24} style={{ color: "var(--text-tertiary)", marginBottom: 8 }} />}
              <span className="text-sm font-medium" style={{ color: "var(--text-tertiary)" }}>{p.name}</span>
              <span className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Coming soon</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function tryParseValidation(errorMessage) {
  try {
    const parsed = JSON.parse(errorMessage);
    if (parsed?.validation) return parsed.validation;
  } catch { /* not JSON */ }
  return null;
}
