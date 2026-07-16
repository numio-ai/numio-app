/**
 * Integration tests for the onboarding hub flow on the Settings → Integrations
 * page. These cover the acceptance criteria of task
 * `aws_onboarding_method_hub`: hub default, Advanced de-emphasis, Chat flag
 * gating, and back-to-hub input preservation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the API modules used by the Integrations page. We only care about the
// onboarding hub behaviour — account-list and feature-flag responses are
// stubbed.
vi.mock("../../api/workspace", () => ({
  listAccounts: vi.fn().mockResolvedValue({ accounts: [], count: 0 }),
  registerAccount: vi.fn(),
  updateAccount: vi.fn(),
  revalidateAccount: vi.fn(),
  deactivateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  getWorkspaceInfo: vi.fn().mockResolvedValue({
    external_id: "ws-external-id-uuid",
    workspace_principal_arn: "arn:aws:iam::000000000000:user/numio-service",
  }),
}));

vi.mock("../../api/onboarding", () => ({
  getOnboardingFeatures: vi.fn().mockResolvedValue({ chat_enabled: false }),
  getCfnTemplate: vi.fn().mockResolvedValue({
    stack_name: "numio-onboarding",
    region: "us-east-1",
    external_id: "ws-external-id-uuid",
    template_format: "yaml",
    template_body: "AWSTemplateFormatVersion: '2010-09-09'\nResources: {}\n",
    launch_url: "https://console.aws.amazon.com/cloudformation/home",
    launch_mode: "upload",
  }),
  getCfnTemplateDownloadUrl: vi.fn(
    () => "http://localhost/api/v1/onboarding/cfn-template/download?region=us-east-1",
  ),
  getOnboardingInProgress: vi.fn().mockResolvedValue(null),
  putOnboardingInProgress: vi.fn().mockResolvedValue({
    label: "x",
    step: "apply",
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
  }),
  deleteOnboardingInProgress: vi.fn().mockResolvedValue(null),
}));

import Integrations from "../../pages/Settings/Integrations";
import {
  getOnboardingFeatures,
  getOnboardingInProgress,
  putOnboardingInProgress,
  deleteOnboardingInProgress,
} from "../../api/onboarding";
import { getWorkspaceInfo } from "../../api/workspace";

beforeEach(() => {
  vi.clearAllMocks();
  getOnboardingFeatures.mockResolvedValue({ chat_enabled: false });
  getOnboardingInProgress.mockResolvedValue(null);
  putOnboardingInProgress.mockResolvedValue({
    label: "x",
    step: "apply",
    created_at: "2026-04-27T00:00:00Z",
    updated_at: "2026-04-27T00:00:00Z",
  });
  deleteOnboardingInProgress.mockResolvedValue(null);
  getWorkspaceInfo.mockResolvedValue({
    external_id: "ws-external-id-uuid",
    workspace_principal_arn: "arn:aws:iam::000000000000:user/numio-service",
  });
});

describe("Onboarding method hub flow", () => {
  it("opens the hub when + Add Account is clicked", async () => {
    render(<Integrations />);
    // Wait for the initial account-list fetch to settle.
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    expect(await screen.findByTestId("onboarding-method-hub")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-method-guided")).toBeInTheDocument();
  });

  it("hides the Chat option in the hub when the flag is off", async () => {
    getOnboardingFeatures.mockResolvedValue({ chat_enabled: false });
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    await screen.findByTestId("onboarding-method-hub");
    expect(screen.queryByTestId("onboarding-method-chat")).toBeNull();
  });

  it("shows Chat option when the server flag is on", async () => {
    getOnboardingFeatures.mockResolvedValue({ chat_enabled: true });
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    // Wait for the chat-enabled flag to land before opening the hub.
    await waitFor(() => expect(getOnboardingFeatures).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("add-account-button"));
    await screen.findByTestId("onboarding-method-hub");
    await waitFor(() =>
      expect(screen.getByTestId("onboarding-method-chat")).toBeInTheDocument(),
    );
  });

  it("Back-to-hub from Guided preserves typed input", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-guided"));
    // Advance into the Customize step — that's where the bucket field lives
    // (only in "Use existing CUR" mode; Create-new hides it).
    fireEvent.click(await screen.findByTestId("guided-next-customize"));
    fireEvent.click(await screen.findByTestId("guided-cur-mode-existing"));
    const bucketInput = await screen.findByTestId("guided-field-bucket");
    fireEvent.change(bucketInput, { target: { value: "acme-cur-bucket" } });
    expect(bucketInput.value).toBe("acme-cur-bucket");

    // After the navigation refactor, "Back to methods" is gone from the
    // Customize step. Step back to Intro first, then exit via the Intro Back
    // button — no persistence has been written yet so it exits directly.
    fireEvent.click(screen.getByTestId("guided-back-intro"));
    await screen.findByTestId("guided-step-intro");
    fireEvent.click(screen.getByTestId("guided-back-to-hub"));
    await screen.findByTestId("onboarding-method-hub");

    // Return to Guided — previous input must still be there in Customize
    // (mode toggle stays at "existing" too, so the bucket field is visible).
    fireEvent.click(screen.getByTestId("onboarding-method-guided"));
    // The wizard always re-enters at the Intro step; click into Customize.
    fireEvent.click(await screen.findByTestId("guided-next-customize"));
    const bucketInputAgain = await screen.findByTestId("guided-field-bucket");
    expect(bucketInputAgain.value).toBe("acme-cur-bucket");
  });

  it("Advanced method reaches the raw form unchanged", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));
    // The Advanced form is the existing raw-field dialog — the header copy
    // now signals the intended audience but the field list is unchanged.
    await screen.findByText(/Advanced: paste existing IAM and CUR details/i);
    expect(screen.getByText(/AWS Access Key ID/i)).toBeInTheDocument();
    expect(screen.getByText(/Role ARN/i)).toBeInTheDocument();
  });

  it("Advanced header positions the form for experts with a subtitle", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));

    // Header copy distinguishes Advanced from Guided/Chat.
    expect(
      await screen.findByText(/Advanced: paste existing IAM and CUR details/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/For users comfortable with IAM roles/i),
    ).toBeInTheDocument();
  });

  it("Advanced form preserves the 14 existing fields unchanged", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));

    // Field-level snapshot: every label that existed before Task 3.
    // If any of these render assertions fail, the raw form has changed.
    await screen.findByText(/AWS Access Key ID/i);
    for (const label of [
      /AWS Secret Access Key/i,
      /AWS Account ID/i,
      /Role ARN/i,
      /External ID/i,
      /Display Name/i,
      /CUR Configuration/i,
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("Back-to-Guided from Advanced preserves typed input", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));

    // Type into the Advanced form.
    const accountIdInput = screen.getByPlaceholderText("123456789012");
    fireEvent.change(accountIdInput, { target: { value: "123456789012" } });
    expect(accountIdInput.value).toBe("123456789012");

    // Click Back to Guided — the Back control is visible only in Advanced.
    fireEvent.click(screen.getByTestId("advanced-back-to-guided"));
    await screen.findByTestId("onboarding-guided");

    // Return to Advanced from the hub → same value must still be there.
    fireEvent.click(screen.getByTestId("guided-back-to-hub"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));
    expect(screen.getByPlaceholderText("123456789012").value).toBe(
      "123456789012",
    );
  });

  it("Advanced form prefills External ID with the workspace's own ExternalId", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    await waitFor(() => expect(getWorkspaceInfo).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));

    const externalIdInput = await screen.findByPlaceholderText(
      /UUID from trust policy/i,
    );
    await waitFor(() =>
      expect(externalIdInput.value).toBe("ws-external-id-uuid"),
    );
  });

  it("Advanced form shows ExternalId helper pointing to the IAM trust policy", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));

    expect(
      await screen.findByText(/sts:ExternalId condition/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Trust relationships/i),
    ).toBeInTheDocument();
  });

  it("Advanced form: user edit overrides the prefilled External ID", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    await waitFor(() => expect(getWorkspaceInfo).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));

    const externalIdInput = await screen.findByPlaceholderText(
      /UUID from trust policy/i,
    );
    await waitFor(() =>
      expect(externalIdInput.value).toBe("ws-external-id-uuid"),
    );

    // User overrides the prefill.
    fireEvent.change(externalIdInput, { target: { value: "custom-trust-uuid" } });
    expect(externalIdInput.value).toBe("custom-trust-uuid");

    // Method-switch must not overwrite the user's value.
    fireEvent.click(screen.getByTestId("advanced-back-to-guided"));
    await screen.findByTestId("onboarding-guided");
    fireEvent.click(screen.getByTestId("guided-back-to-hub"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));
    expect(
      screen.getByPlaceholderText(/UUID from trust policy/i).value,
    ).toBe("custom-trust-uuid");
  });

  it("Guided wizard prefills External ID on the Waiting step", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    await waitFor(() => expect(getWorkspaceInfo).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-guided"));

    // Walk to the Waiting step where the External ID input lives.
    fireEvent.click(await screen.findByTestId("guided-next-customize"));
    fireEvent.click(await screen.findByTestId("guided-next-apply"));
    await screen.findByTestId("guided-launch-url");
    fireEvent.click(screen.getByTestId("guided-next-waiting"));

    const externalIdInput = await screen.findByTestId(
      "guided-field-external-id",
    );
    expect(externalIdInput.value).toBe("ws-external-id-uuid");
  });

  it("falls back to empty External ID when workspace info fetch fails", async () => {
    getWorkspaceInfo.mockRejectedValue(new Error("network down"));
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    await waitFor(() => expect(getWorkspaceInfo).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("add-account-button"));
    fireEvent.click(await screen.findByTestId("onboarding-method-advanced"));

    const externalIdInput = await screen.findByPlaceholderText(
      /UUID from trust policy/i,
    );
    expect(externalIdInput.value).toBe("");
  });

  it("Cancel on the hub closes the Add flow entirely", async () => {
    render(<Integrations />);
    await waitFor(() =>
      expect(screen.getByTestId("add-account-button")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("add-account-button"));
    await screen.findByTestId("onboarding-method-hub");
    fireEvent.click(screen.getByTestId("onboarding-hub-cancel"));
    await waitFor(() =>
      expect(screen.queryByTestId("onboarding-method-hub")).toBeNull(),
    );
  });
});
