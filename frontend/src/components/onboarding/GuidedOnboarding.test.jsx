/**
 * Unit tests for the Guided CloudFormation onboarding wizard.
 *
 * Exercises the six-step flow (intro → customize → apply → waiting → verify
 * → success) with the onboarding, workspace, and jobs APIs all mocked so no
 * network I/O happens.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("../../api/onboarding", () => ({
  getCfnTemplate: vi.fn(),
  getCfnTemplateDownloadUrl: vi.fn(
    () => "http://localhost/api/v1/onboarding/cfn-template/download?region=us-east-1",
  ),
  getOnboardingInProgress: vi.fn(),
  putOnboardingInProgress: vi.fn(),
  deleteOnboardingInProgress: vi.fn(),
}));
vi.mock("../../api/workspace", () => ({
  registerAccount: vi.fn(),
  updateAccount: vi.fn(),
  listAccounts: vi.fn(),
}));
vi.mock("../../api/jobs", () => ({
  triggerJob: vi.fn(),
}));

import GuidedOnboarding, {
  defaultLabel,
} from "./GuidedOnboarding";
import {
  deleteOnboardingInProgress,
  getCfnTemplate,
  putOnboardingInProgress,
} from "../../api/onboarding";
import {
  registerAccount,
  updateAccount,
  listAccounts,
} from "../../api/workspace";
import { triggerJob } from "../../api/jobs";

const SAMPLE_TEMPLATE = {
  stack_name: "NumioConnect-2604261950",
  region: "us-east-1",
  external_id: "tenant-uuid",
  label: "2604261950",
  template_format: "yaml",
  template_body:
    "AWSTemplateFormatVersion: '2010-09-09'\nResources: {}\n",
  launch_url: "https://console.aws.amazon.com/cloudformation/home",
  launch_mode: "upload",
  download_url:
    "/api/v1/onboarding/cfn-template/download?region=us-east-1&label=2604261950",
};

function Harness({ onAccountRegistered, onDone, onBack, initialLabel, initialStep }) {
  const [form, setForm] = React.useState({
    region: "us-east-1",
    curBucketName: "",
    curPathPrefix: "cur",
    curReportName: "",
    ...(initialLabel !== undefined ? { label: initialLabel } : {}),
  });
  return (
    <GuidedOnboarding
      form={form}
      setForm={setForm}
      initialStep={initialStep}
      onBack={onBack || (() => {})}
      onAccountRegistered={onAccountRegistered}
      onDone={onDone}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getCfnTemplate.mockResolvedValue(SAMPLE_TEMPLATE);
  registerAccount.mockReset();
  updateAccount.mockReset();
  listAccounts.mockReset();
  triggerJob.mockResolvedValue({ status: "queued" });
  putOnboardingInProgress.mockResolvedValue({
    label: "x",
    step: "apply",
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
  });
  deleteOnboardingInProgress.mockResolvedValue(null);
});

// Walks the wizard from intro to the verify step with default field values.
async function advanceToVerify() {
  fireEvent.click(screen.getByTestId("guided-next-customize"));
  await screen.findByTestId("guided-step-customize");
  fireEvent.click(screen.getByTestId("guided-next-apply"));
  await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
  await screen.findByTestId("guided-launch-url");
  fireEvent.click(screen.getByTestId("guided-next-waiting"));
  for (const [id, v] of [
    ["guided-field-account-id", "123456789012"],
    ["guided-field-role-arn", "arn:aws:iam::123456789012:role/x"],
    ["guided-field-access-key", "AKIA"],
    ["guided-field-secret", "sec"],
    ["guided-field-external-id", "ext"],
  ]) {
    fireEvent.change(screen.getByTestId(id), { target: { value: v } });
  }
  fireEvent.click(screen.getByTestId("guided-next-verify"));
}

describe("GuidedOnboarding", () => {
  it("starts on the intro step and advances to Customize", async () => {
    render(<Harness />);
    expect(screen.getByTestId("guided-step-intro")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    expect(await screen.findByTestId("guided-step-customize")).toBeInTheDocument();
  });

  it("generates the template on entering the Apply step", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    // Switch into "Use existing CUR" so the bucket field is reachable; the
    // Create-new path is exercised separately below.
    fireEvent.click(screen.getByTestId("guided-cur-mode-existing"));
    fireEvent.change(screen.getByTestId("guided-field-bucket"), {
      target: { value: "acme-cur" },
    });
    fireEvent.click(screen.getByTestId("guided-next-apply"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    const call = getCfnTemplate.mock.calls[0][0];
    expect(call.curBucketName).toBe("acme-cur");
    expect(call.curMode).toBe("existing");
    // The label is mandatory, so the API call must carry one.
    expect(call.label).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/);
    // Apply-step UI shows Launch URL + Download link.
    expect(await screen.findByTestId("guided-launch-url")).toBeInTheDocument();
    expect(screen.getByTestId("guided-download-url")).toBeInTheDocument();
    expect(screen.getByTestId("guided-template-details")).toBeInTheDocument();
  });

  it("passes enableTagWrites to the template request when the checkbox is on", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    // Default: checkbox off → template request carries enableTagWrites=false.
    fireEvent.click(screen.getByTestId("guided-field-enable-tag-writes"));
    fireEvent.click(screen.getByTestId("guided-next-apply"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    expect(getCfnTemplate.mock.calls[0][0].enableTagWrites).toBe(true);
  });

  describe("label field", () => {
    it("pre-populates the label input with a DDMMYYHHMM-shaped default", async () => {
      // The exact value is a moving target (current time); assert the format.
      // Deterministic formatting is covered by the defaultLabel unit test.
      render(<Harness />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      const input = screen.getByTestId("guided-field-label");
      expect(input.value).toMatch(/^\d{10}$/);
    });

    it("renders elaborate help text covering purpose, format, and override", async () => {
      render(<Harness />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      const help = screen.getByTestId("guided-field-label-help").textContent;
      // Why
      expect(help).toMatch(/multiple Numio instances|same AWS account/i);
      expect(help).toMatch(/AWS admin/i);
      // What format
      expect(help).toMatch(/lowercase letters, digits, and hyphens/i);
      // Override hint
      expect(help).toMatch(/override|worktree name|deployment tag/i);
    });

    it("disables Generate template when label is invalid and shows inline error", async () => {
      render(<Harness />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      const input = screen.getByTestId("guided-field-label");
      // Invalid: uppercase + underscore
      fireEvent.change(input, { target: { value: "Has_Bad_Chars" } });
      expect(screen.getByTestId("guided-next-apply")).toBeDisabled();
      expect(
        screen.getByTestId("guided-field-label-error"),
      ).toBeInTheDocument();
    });

    it("disables Generate template when label is empty", async () => {
      render(<Harness initialLabel="" />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      // The first-mount effect will have seeded a default; clear it back to empty.
      fireEvent.change(screen.getByTestId("guided-field-label"), {
        target: { value: "" },
      });
      expect(screen.getByTestId("guided-next-apply")).toBeDisabled();
    });

    it("forwards the label to getCfnTemplate", async () => {
      render(<Harness initialLabel="my-wkt" />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      fireEvent.click(screen.getByTestId("guided-next-apply"));
      await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
      expect(getCfnTemplate.mock.calls[0][0].label).toBe("my-wkt");
    });

    it("defaultLabel formats as DDMMYYHHMM", () => {
      expect(defaultLabel(new Date(2026, 3, 26, 19, 50))).toBe("2604261950");
      expect(defaultLabel(new Date(2026, 0, 1, 0, 0))).toBe("0101260000");
    });
  });

  it("verify step shows pass/fail per validation step and transitions to success when connected", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "abc", alias: "Test Account" },
      validation: {
        overall_status: "connected",
        steps: [
          { name: "credentials", label: "Verify credentials", status: "pass" },
          { name: "role_assume", label: "Assume role", status: "pass" },
          { name: "s3_read", label: "Read CUR file from S3", status: "pass" },
        ],
      },
    });

    const onAccountRegistered = vi.fn();
    render(<Harness onAccountRegistered={onAccountRegistered} />);

    // Walk through intro → customize → apply.
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    fireEvent.click(screen.getByTestId("guided-next-apply"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    await screen.findByTestId("guided-launch-url");
    fireEvent.click(screen.getByTestId("guided-next-waiting"));

    // Fill Outputs paste-back fields.
    fireEvent.change(screen.getByTestId("guided-field-account-id"), {
      target: { value: "123456789012" },
    });
    fireEvent.change(screen.getByTestId("guided-field-role-arn"), {
      target: { value: "arn:aws:iam::123456789012:role/numio/NumioCurReaderRole" },
    });
    fireEvent.change(screen.getByTestId("guided-field-access-key"), {
      target: { value: "AKIAEXAMPLE" },
    });
    fireEvent.change(screen.getByTestId("guided-field-secret"), {
      target: { value: "secret-value" },
    });
    fireEvent.change(screen.getByTestId("guided-field-external-id"), {
      target: { value: "tenant-uuid" },
    });

    fireEvent.click(screen.getByTestId("guided-next-verify"));

    await waitFor(() => expect(registerAccount).toHaveBeenCalled());
    // Validation renders with three pass rows.
    await screen.findByTestId("guided-step-success");
    expect(onAccountRegistered).toHaveBeenCalled();
  });

  it("shows fail detail and does not advance when validation fails", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "abc", alias: "Test Account" },
      validation: {
        overall_status: "disconnected",
        steps: [
          { name: "credentials", label: "Verify credentials", status: "pass" },
          {
            name: "role_assume",
            label: "Assume role",
            status: "fail",
            error: "AssumeRole failed: AccessDenied",
          },
        ],
      },
    });
    render(<Harness />);
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    fireEvent.click(screen.getByTestId("guided-next-apply"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    await screen.findByTestId("guided-launch-url");
    fireEvent.click(screen.getByTestId("guided-next-waiting"));

    for (const [id, v] of [
      ["guided-field-account-id", "123456789012"],
      ["guided-field-role-arn", "arn:aws:iam::123456789012:role/x"],
      ["guided-field-access-key", "AKIA"],
      ["guided-field-secret", "sec"],
      ["guided-field-external-id", "ext"],
    ]) {
      fireEvent.change(screen.getByTestId(id), { target: { value: v } });
    }
    fireEvent.click(screen.getByTestId("guided-next-verify"));
    await waitFor(() =>
      expect(screen.getByTestId("guided-validation-steps")).toBeInTheDocument(),
    );
    // Stayed on the verify step (not success).
    expect(screen.queryByTestId("guided-step-success")).toBeNull();
    expect(screen.getByTestId("guided-retry-verify")).toBeInTheDocument();
    // Fail error is surfaced.
    expect(
      screen.getByText(/AssumeRole failed: AccessDenied/i),
    ).toBeInTheDocument();
  });

  it("success step triggers first sync via /jobs/cur_ingestion/trigger", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "abc", alias: "Test Account" },
      validation: {
        overall_status: "connected",
        steps: [
          { name: "credentials", label: "Verify credentials", status: "pass" },
        ],
      },
    });
    render(<Harness />);
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    fireEvent.click(screen.getByTestId("guided-next-apply"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    await screen.findByTestId("guided-launch-url");
    fireEvent.click(screen.getByTestId("guided-next-waiting"));
    for (const [id, v] of [
      ["guided-field-account-id", "123456789012"],
      ["guided-field-role-arn", "arn:aws:iam::123456789012:role/x"],
      ["guided-field-access-key", "AKIA"],
      ["guided-field-secret", "sec"],
      ["guided-field-external-id", "ext"],
    ]) {
      fireEvent.change(screen.getByTestId(id), { target: { value: v } });
    }
    fireEvent.click(screen.getByTestId("guided-next-verify"));
    await screen.findByTestId("guided-step-success");

    fireEvent.click(screen.getByTestId("guided-trigger-sync"));
    await waitFor(() => expect(triggerJob).toHaveBeenCalledWith("cur_ingestion"));
    await waitFor(() =>
      expect(screen.getByTestId("guided-trigger-sync")).toHaveTextContent(
        /First sync queued/,
      ),
    );
  });

  it("renders four pending rows during validation and updates them on response", async () => {
    let resolveRegister;
    registerAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        }),
    );

    render(<Harness />);
    await advanceToVerify();

    // While in flight: button label shows Validating…, disabled, and four
    // pending rows render with the canonical step labels.
    const submit = await screen.findByTestId("guided-retry-verify");
    expect(submit).toHaveTextContent(/Validating/i);
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");

    expect(screen.getByText("Verify AWS credentials")).toBeInTheDocument();
    expect(screen.getByText("Assume customer role")).toBeInTheDocument();
    expect(screen.getByText("List CUR objects in S3")).toBeInTheDocument();
    expect(screen.getByText("Read CUR file from S3")).toBeInTheDocument();

    // Verify-step paste-back fields are disabled while in flight.
    expect(screen.getByTestId("guided-verify-field-account-id")).toBeDisabled();

    // Resolve with a fail; pending rows are replaced and overall is shown.
    resolveRegister({
      account: { id: "abc" },
      validation: {
        overall_status: "disconnected",
        steps: [
          { name: "credentials", label: "Verify AWS credentials", status: "fail", error: "InvalidClientTokenId" },
          { name: "role_assume", label: "Assume customer role", status: "skip" },
          { name: "s3_list", label: "List CUR objects in S3", status: "skip" },
          { name: "s3_read", label: "Read CUR file from S3", status: "skip" },
        ],
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId("guided-retry-verify")).toHaveTextContent(/Validate again/i),
    );
    expect(screen.getByText(/InvalidClientTokenId/)).toBeInTheDocument();
    expect(screen.getByText(/Overall: disconnected/)).toBeInTheDocument();
  });

  it("retry after fail uses updateAccount and clears prior result rows during the call", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "acc-id-1" },
      validation: {
        overall_status: "disconnected",
        steps: [
          { name: "credentials", label: "Verify AWS credentials", status: "fail", error: "bad creds" },
        ],
      },
    });

    let resolveUpdate;
    updateAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<Harness />);
    await advanceToVerify();

    // First validation completes with a fail.
    await waitFor(() =>
      expect(screen.getByTestId("guided-retry-verify")).toHaveTextContent(/Validate again/i),
    );
    expect(screen.getByText("bad creds")).toBeInTheDocument();

    // User edits the secret and clicks Validate again.
    fireEvent.change(screen.getByTestId("guided-verify-field-secret"), {
      target: { value: "new-secret" },
    });
    fireEvent.click(screen.getByTestId("guided-retry-verify"));

    // While the retry is in flight, prior fail row is gone and pending rows
    // render. Backend was called via updateAccount, not registerAccount again.
    await waitFor(() =>
      expect(screen.getByTestId("guided-retry-verify")).toBeDisabled(),
    );
    expect(updateAccount).toHaveBeenCalledWith(
      "acc-id-1",
      expect.objectContaining({ aws_secret_access_key: "new-secret" }),
    );
    expect(screen.queryByText("bad creds")).toBeNull();
    expect(screen.getByText("Verify AWS credentials")).toBeInTheDocument();

    resolveUpdate({
      account: { id: "acc-id-1" },
      validation: {
        overall_status: "connected",
        steps: [
          { name: "credentials", label: "Verify AWS credentials", status: "pass" },
          { name: "role_assume", label: "Assume customer role", status: "pass" },
        ],
      },
    });
    await screen.findByTestId("guided-step-success");
  });

  it("falls back to updateAccount when register returns 409 already-registered", async () => {
    registerAccount.mockRejectedValue(
      new Error("AWS account 123456789012 is already registered"),
    );
    listAccounts.mockResolvedValue({
      accounts: [{ id: "existing-id", aws_account_id: "123456789012" }],
    });
    updateAccount.mockResolvedValue({
      account: { id: "existing-id" },
      validation: {
        overall_status: "connected",
        steps: [
          { name: "credentials", label: "Verify AWS credentials", status: "pass" },
        ],
      },
    });

    render(<Harness />);
    await advanceToVerify();

    await waitFor(() => expect(updateAccount).toHaveBeenCalled());
    expect(updateAccount).toHaveBeenCalledWith(
      "existing-id",
      expect.objectContaining({ aws_account_id: "123456789012" }),
    );
    await screen.findByTestId("guided-step-success");
  });

  it("Verify connection on Waiting with empty paste-back fields shows inline error and does not transition", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    fireEvent.click(screen.getByTestId("guided-next-apply"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    await screen.findByTestId("guided-launch-url");
    fireEvent.click(screen.getByTestId("guided-next-waiting"));

    // Fill only the credentials, leave AwsAccountId / RoleArn / ExternalId empty.
    fireEvent.change(screen.getByTestId("guided-field-access-key"), {
      target: { value: "AKIA" },
    });
    fireEvent.change(screen.getByTestId("guided-field-secret"), {
      target: { value: "sec" },
    });

    // Button is enabled (not silently dead) and clicking surfaces the missing
    // fields. The wizard does not transition to Verify and the API isn't hit.
    const btn = screen.getByTestId("guided-next-verify");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(screen.getByTestId("guided-waiting-error")).toHaveTextContent(
      /AwsAccountId.*RoleArn.*ExternalId/,
    );
    expect(screen.queryByTestId("guided-step-verify")).toBeNull();
    expect(registerAccount).not.toHaveBeenCalled();
    expect(updateAccount).not.toHaveBeenCalled();

    // Empty fields are flagged via aria-invalid for visual feedback.
    expect(screen.getByTestId("guided-field-account-id")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByTestId("guided-field-role-arn")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    // Filled credentials are not flagged.
    expect(
      screen.getByTestId("guided-field-access-key"),
    ).not.toHaveAttribute("aria-invalid", "true");
  });

  it("Waiting step paste-back inputs render with editable (non-inset) background on the three empty mandatory fields", async () => {
    // Regression guard for the bug where AwsAccountId / RoleArn / AccessKeyId
    // visually blended with the surrounding var(--bg-inset) panel and read as
    // disabled. ExternalId stays unstyled (prepopulated UX), SecretAccessKey
    // is left to the browser default for password inputs.
    render(<Harness />);
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    fireEvent.click(screen.getByTestId("guided-next-apply"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    await screen.findByTestId("guided-launch-url");
    fireEvent.click(screen.getByTestId("guided-next-waiting"));

    for (const id of [
      "guided-field-account-id",
      "guided-field-role-arn",
      "guided-field-access-key",
    ]) {
      expect(screen.getByTestId(id).style.background).toBe("var(--bg)");
    }
    expect(screen.getByTestId("guided-field-external-id").style.background).toBe("");
    expect(screen.getByTestId("guided-field-secret").style.background).toBe("");
  });

  it("Back from Customize returns to Intro without losing form values", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    fireEvent.click(screen.getByTestId("guided-cur-mode-existing"));
    fireEvent.change(screen.getByTestId("guided-field-bucket"), {
      target: { value: "acme-cur" },
    });
    fireEvent.click(screen.getByTestId("guided-back-intro"));
    await screen.findByTestId("guided-step-intro");
    fireEvent.click(screen.getByTestId("guided-next-customize"));
    await screen.findByTestId("guided-step-customize");
    expect(screen.getByTestId("guided-field-bucket").value).toBe("acme-cur");
  });

  describe("in-progress persistence", () => {
    it("does not PUT before Customize is submitted", async () => {
      render(<Harness />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      // Going Intro → Customize must not persist anything yet.
      expect(putOnboardingInProgress).not.toHaveBeenCalled();
    });

    it("PUTs step=apply when user clicks Generate template", async () => {
      render(<Harness initialLabel="my-wkt" />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      fireEvent.click(screen.getByTestId("guided-next-apply"));
      await waitFor(() => expect(putOnboardingInProgress).toHaveBeenCalled());
      expect(putOnboardingInProgress).toHaveBeenCalledWith({
        label: "my-wkt",
        step: "apply",
      });
    });

    it("PUTs on every step transition once persistence is active", async () => {
      render(<Harness initialLabel="my-wkt" />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      fireEvent.click(screen.getByTestId("guided-next-apply"));
      await screen.findByTestId("guided-launch-url");
      fireEvent.click(screen.getByTestId("guided-next-waiting"));
      await screen.findByTestId("guided-step-waiting");
      const calls = putOnboardingInProgress.mock.calls.map((c) => c[0].step);
      expect(calls).toEqual(["apply", "waiting"]);
    });

    it("auto-restores at the persisted step", async () => {
      render(<Harness initialLabel="my-wkt" initialStep="apply" />);
      // Wizard mounts directly at Apply, never showing Intro.
      await screen.findByTestId("guided-step-apply");
      expect(screen.queryByTestId("guided-step-intro")).toBeNull();
    });

    it("DELETEs the in-progress record on successful registration", async () => {
      registerAccount.mockResolvedValue({
        account: { id: "abc" },
        validation: {
          overall_status: "connected",
          steps: [
            { name: "credentials", label: "Verify AWS credentials", status: "pass" },
          ],
        },
      });
      render(<Harness />);
      await advanceToVerify();
      await screen.findByTestId("guided-step-success");
      await waitFor(() =>
        expect(deleteOnboardingInProgress).toHaveBeenCalledTimes(1),
      );
    });

    it("does NOT DELETE when validation fails (record must survive for resume)", async () => {
      registerAccount.mockResolvedValue({
        account: { id: "abc" },
        validation: {
          overall_status: "disconnected",
          steps: [
            { name: "credentials", label: "Verify AWS credentials", status: "fail", error: "bad" },
          ],
        },
      });
      render(<Harness />);
      await advanceToVerify();
      await waitFor(() => expect(registerAccount).toHaveBeenCalled());
      expect(deleteOnboardingInProgress).not.toHaveBeenCalled();
    });
  });

  describe("navigation refactor", () => {
    it("removes Back-to-methods from intermediate steps; shows Cancel onboarding instead", async () => {
      render(<Harness />);
      // Intro: Back to methods is present, Cancel is not.
      expect(screen.getByTestId("guided-back-to-hub")).toBeInTheDocument();
      expect(screen.queryByTestId("guided-cancel-onboarding")).toBeNull();

      // Customize: Back to methods absent, Cancel present.
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      expect(screen.queryByTestId("guided-back-to-hub")).toBeNull();
      expect(screen.getByTestId("guided-cancel-onboarding")).toBeInTheDocument();

      // Apply: same.
      fireEvent.click(screen.getByTestId("guided-next-apply"));
      await screen.findByTestId("guided-launch-url");
      expect(screen.queryByTestId("guided-back-to-hub")).toBeNull();
      expect(screen.getByTestId("guided-cancel-onboarding")).toBeInTheDocument();

      // Waiting: same.
      fireEvent.click(screen.getByTestId("guided-next-waiting"));
      await screen.findByTestId("guided-step-waiting");
      expect(screen.queryByTestId("guided-back-to-hub")).toBeNull();
      expect(screen.getByTestId("guided-cancel-onboarding")).toBeInTheDocument();
    });

    it("Intro Back-to-methods exits directly when no persistence has started", async () => {
      const onBack = vi.fn();
      render(<Harness onBack={onBack} />);
      fireEvent.click(screen.getByTestId("guided-back-to-hub"));
      expect(onBack).toHaveBeenCalled();
      expect(screen.queryByTestId("guided-cancel-modal")).toBeNull();
      expect(deleteOnboardingInProgress).not.toHaveBeenCalled();
    });
  });

  describe("Cancel onboarding modal", () => {
    it("opens the modal from Customize-onward steps", async () => {
      render(<Harness />);
      fireEvent.click(screen.getByTestId("guided-next-customize"));
      await screen.findByTestId("guided-step-customize");
      fireEvent.click(screen.getByTestId("guided-next-apply"));
      await screen.findByTestId("guided-launch-url");
      fireEvent.click(screen.getByTestId("guided-cancel-onboarding"));
      expect(await screen.findByTestId("guided-cancel-modal")).toBeInTheDocument();
    });

    it("disables Cancel confirm until the checkbox is acknowledged", async () => {
      render(<Harness initialStep="apply" initialLabel="my-wkt" />);
      await screen.findByTestId("guided-step-apply");
      fireEvent.click(screen.getByTestId("guided-cancel-onboarding"));
      const confirm = await screen.findByTestId("guided-cancel-confirm");
      expect(confirm).toBeDisabled();
      fireEvent.click(screen.getByTestId("guided-cancel-ack"));
      expect(confirm).not.toBeDisabled();
    });

    it("confirming Cancel deletes the record and calls onBack", async () => {
      const onBack = vi.fn();
      render(
        <Harness onBack={onBack} initialStep="apply" initialLabel="my-wkt" />,
      );
      await screen.findByTestId("guided-step-apply");
      fireEvent.click(screen.getByTestId("guided-cancel-onboarding"));
      await screen.findByTestId("guided-cancel-modal");
      fireEvent.click(screen.getByTestId("guided-cancel-ack"));
      fireEvent.click(screen.getByTestId("guided-cancel-confirm"));
      await waitFor(() =>
        expect(deleteOnboardingInProgress).toHaveBeenCalled(),
      );
      await waitFor(() => expect(onBack).toHaveBeenCalled());
    });

    it("Keep onboarding dismisses the modal without deleting", async () => {
      render(<Harness initialStep="apply" initialLabel="my-wkt" />);
      await screen.findByTestId("guided-step-apply");
      fireEvent.click(screen.getByTestId("guided-cancel-onboarding"));
      await screen.findByTestId("guided-cancel-modal");
      fireEvent.click(screen.getByTestId("guided-cancel-dismiss"));
      await waitFor(() =>
        expect(screen.queryByTestId("guided-cancel-modal")).toBeNull(),
      );
      expect(deleteOnboardingInProgress).not.toHaveBeenCalled();
    });

    it("DELETE failure surfaces an error and keeps the modal open", async () => {
      const onBack = vi.fn();
      deleteOnboardingInProgress.mockRejectedValueOnce(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      );
      render(
        <Harness onBack={onBack} initialStep="apply" initialLabel="my-wkt" />,
      );
      await screen.findByTestId("guided-step-apply");
      fireEvent.click(screen.getByTestId("guided-cancel-onboarding"));
      await screen.findByTestId("guided-cancel-modal");
      fireEvent.click(screen.getByTestId("guided-cancel-ack"));
      fireEvent.click(screen.getByTestId("guided-cancel-confirm"));
      await waitFor(() =>
        expect(deleteOnboardingInProgress).toHaveBeenCalledTimes(1),
      );
      // Error rendered, modal still open, onBack not called.
      expect(await screen.findByTestId("guided-cancel-error")).toHaveTextContent(
        /Backend didn't respond in time/i,
      );
      expect(screen.getByTestId("guided-cancel-modal")).toBeInTheDocument();
      expect(onBack).not.toHaveBeenCalled();
      // Retry: next call succeeds, modal closes, onBack fires.
      deleteOnboardingInProgress.mockResolvedValueOnce(null);
      fireEvent.click(screen.getByTestId("guided-cancel-confirm"));
      await waitFor(() =>
        expect(deleteOnboardingInProgress).toHaveBeenCalledTimes(2),
      );
      await waitFor(() => expect(onBack).toHaveBeenCalled());
    });

    it("Keep onboarding clears any prior error", async () => {
      deleteOnboardingInProgress.mockRejectedValueOnce(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      );
      render(<Harness initialStep="apply" initialLabel="my-wkt" />);
      await screen.findByTestId("guided-step-apply");
      fireEvent.click(screen.getByTestId("guided-cancel-onboarding"));
      await screen.findByTestId("guided-cancel-modal");
      fireEvent.click(screen.getByTestId("guided-cancel-ack"));
      fireEvent.click(screen.getByTestId("guided-cancel-confirm"));
      await screen.findByTestId("guided-cancel-error");
      fireEvent.click(screen.getByTestId("guided-cancel-dismiss"));
      await waitFor(() =>
        expect(screen.queryByTestId("guided-cancel-modal")).toBeNull(),
      );
      // Re-open: error must not persist across modal dismissals.
      fireEvent.click(screen.getByTestId("guided-cancel-onboarding"));
      await screen.findByTestId("guided-cancel-modal");
      expect(screen.queryByTestId("guided-cancel-error")).toBeNull();
    });
  });
});
