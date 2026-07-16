/**
 * Unit tests for the Chat-driven onboarding v0 scripted flow.
 *
 * Drives the full state machine with mocked onboarding / workspace / jobs
 * APIs. Reuses the same SAMPLE_TEMPLATE shape as the Guided wizard test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("../../api/onboarding", () => ({
  getCfnTemplate: vi.fn(),
  getCfnTemplateDownloadUrl: vi.fn(
    () => "http://localhost/api/v1/onboarding/cfn-template/download?region=us-east-1",
  ),
}));
vi.mock("../../api/workspace", () => ({
  registerAccount: vi.fn(),
}));
vi.mock("../../api/jobs", () => ({
  triggerJob: vi.fn(),
}));

import ChatOnboarding from "./ChatOnboarding";
import { getCfnTemplate } from "../../api/onboarding";
import { registerAccount } from "../../api/workspace";
import { triggerJob } from "../../api/jobs";

const SAMPLE_TEMPLATE = {
  stack_name: "numio-onboarding",
  region: "us-east-1",
  external_id: "tenant-uuid",
  template_format: "yaml",
  template_body: "AWSTemplateFormatVersion: '2010-09-09'\nResources: {}\n",
  launch_url: "https://console.aws.amazon.com/cloudformation/home",
  launch_mode: "upload",
  download_url: "/api/v1/onboarding/cfn-template/download?region=us-east-1",
};

function Harness({ onBack, onAccountRegistered, onDone }) {
  const [form, setForm] = React.useState({});
  return (
    <ChatOnboarding
      form={form}
      setForm={setForm}
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
  triggerJob.mockResolvedValue({ status: "queued" });
});

async function walkToApply({ region = "us-east-1", bucket = "acme-cur" } = {}) {
  fireEvent.click(screen.getByTestId("chat-qr-start"));
  // Region picker with common regions as quick replies.
  fireEvent.click(await screen.findByTestId(`chat-region-${region}`));
  // Bucket input.
  const bucketInput = await screen.findByTestId("chat-bucket-input");
  fireEvent.change(bucketInput, { target: { value: bucket } });
  fireEvent.click(screen.getByTestId("chat-bucket-submit"));
  await screen.findByTestId("chat-msg-apply");
}

describe("ChatOnboarding v0", () => {
  it("greets and offers constrained quick replies (yes / not now)", () => {
    render(<Harness />);
    expect(screen.getByTestId("chat-msg-greet")).toBeInTheDocument();
    expect(screen.getByTestId("chat-qr-start")).toBeInTheDocument();
    expect(screen.getByTestId("chat-qr-abort")).toBeInTheDocument();
  });

  it("'Not now' exits to the hub without mutating accounts", () => {
    const onBack = vi.fn();
    render(<Harness onBack={onBack} />);
    fireEvent.click(screen.getByTestId("chat-qr-abort"));
    expect(onBack).toHaveBeenCalled();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("walks through greet → region → bucket → apply and generates template", async () => {
    render(<Harness />);
    await walkToApply();
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    const call = getCfnTemplate.mock.calls[0][0];
    expect(call.region).toBe("us-east-1");
    expect(call.curBucketName).toBe("acme-cur");
    // Apply turn surfaces the Launch and Download buttons.
    expect(await screen.findByTestId("chat-launch-url")).toBeInTheDocument();
    expect(screen.getByTestId("chat-download-url")).toBeInTheDocument();
  });

  it("accepts a custom region via free text input", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("chat-qr-start"));
    fireEvent.change(await screen.findByTestId("chat-region-custom"), {
      target: { value: "eu-north-1" },
    });
    fireEvent.click(screen.getByTestId("chat-region-submit"));
    const bucketInput = await screen.findByTestId("chat-bucket-input");
    fireEvent.change(bucketInput, { target: { value: "skip" } });
    fireEvent.click(screen.getByTestId("chat-bucket-submit"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    expect(getCfnTemplate.mock.calls[0][0].region).toBe("eu-north-1");
  });

  it("treats 'skip' as empty bucket name", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("chat-qr-start"));
    fireEvent.click(await screen.findByTestId("chat-region-us-east-1"));
    const bucketInput = await screen.findByTestId("chat-bucket-input");
    fireEvent.change(bucketInput, { target: { value: "skip" } });
    fireEvent.click(screen.getByTestId("chat-bucket-submit"));
    await waitFor(() => expect(getCfnTemplate).toHaveBeenCalled());
    expect(getCfnTemplate.mock.calls[0][0].curBucketName).toBe("");
  });

  it("reuses registerAccount and advances to success on 'connected'", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "abc", alias: "Test" },
      validation: {
        overall_status: "connected",
        steps: [
          { name: "credentials", label: "Verify credentials", status: "pass" },
          { name: "role_assume", label: "Assume role", status: "pass" },
          { name: "s3_read", label: "Read CUR from S3", status: "pass" },
        ],
      },
    });
    const onAccountRegistered = vi.fn();
    render(<Harness onAccountRegistered={onAccountRegistered} />);
    await walkToApply();
    await screen.findByTestId("chat-launch-url");
    fireEvent.click(screen.getByTestId("chat-qr-applied"));
    fireEvent.click(await screen.findByTestId("chat-qr-stack-done"));

    fireEvent.change(await screen.findByTestId("chat-output-awsAccountId"), {
      target: { value: "123456789012" },
    });
    fireEvent.change(screen.getByTestId("chat-output-roleArn"), {
      target: { value: "arn:aws:iam::123456789012:role/r" },
    });
    fireEvent.change(screen.getByTestId("chat-output-awsAccessKeyId"), {
      target: { value: "AKIA" },
    });
    fireEvent.change(screen.getByTestId("chat-output-awsSecretAccessKey"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByTestId("chat-output-externalId"), {
      target: { value: "ext" },
    });
    fireEvent.click(screen.getByTestId("chat-outputs-submit"));

    await waitFor(() => expect(registerAccount).toHaveBeenCalled());
    expect(onAccountRegistered).toHaveBeenCalled();
    expect(
      await screen.findByTestId("chat-msg-success"),
    ).toBeInTheDocument();
  });

  it("holds on verify when validation fails and offers retry / fix-outputs", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "abc", alias: "Test" },
      validation: {
        overall_status: "disconnected",
        steps: [
          {
            name: "role_assume",
            label: "Assume role",
            status: "fail",
            error: "AccessDenied",
          },
        ],
      },
    });
    render(<Harness />);
    await walkToApply();
    await screen.findByTestId("chat-launch-url");
    fireEvent.click(screen.getByTestId("chat-qr-applied"));
    fireEvent.click(await screen.findByTestId("chat-qr-stack-done"));
    for (const [id, v] of [
      ["chat-output-awsAccountId", "1"],
      ["chat-output-roleArn", "r"],
      ["chat-output-awsAccessKeyId", "a"],
      ["chat-output-awsSecretAccessKey", "s"],
      ["chat-output-externalId", "e"],
    ]) {
      fireEvent.change(await screen.findByTestId(id), { target: { value: v } });
    }
    fireEvent.click(screen.getByTestId("chat-outputs-submit"));

    await screen.findByTestId("chat-msg-verify");
    expect(screen.queryByTestId("chat-msg-success")).toBeNull();
    expect(screen.getByTestId("chat-qr-retry-verify")).toBeInTheDocument();
    expect(screen.getByText(/AccessDenied/)).toBeInTheDocument();
  });

  it("does not call registerAccount if the user exits mid-flow", async () => {
    const onBack = vi.fn();
    render(<Harness onBack={onBack} />);
    fireEvent.click(screen.getByTestId("chat-qr-start"));
    fireEvent.click(await screen.findByTestId("chat-region-us-east-1"));
    // Exit before submitting outputs.
    fireEvent.click(screen.getByTestId("chat-back-to-hub"));
    expect(onBack).toHaveBeenCalled();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("success 'Later' button calls onDone without triggering sync", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "abc", alias: "Test" },
      validation: {
        overall_status: "connected",
        steps: [{ name: "credentials", label: "Verify credentials", status: "pass" }],
      },
    });
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    await walkToApply();
    await screen.findByTestId("chat-launch-url");
    fireEvent.click(screen.getByTestId("chat-qr-applied"));
    fireEvent.click(await screen.findByTestId("chat-qr-stack-done"));
    for (const [id, v] of [
      ["chat-output-awsAccountId", "1"],
      ["chat-output-roleArn", "r"],
      ["chat-output-awsAccessKeyId", "a"],
      ["chat-output-awsSecretAccessKey", "s"],
      ["chat-output-externalId", "e"],
    ]) {
      fireEvent.change(await screen.findByTestId(id), { target: { value: v } });
    }
    fireEvent.click(screen.getByTestId("chat-outputs-submit"));
    await screen.findByTestId("chat-msg-success");
    fireEvent.click(screen.getByTestId("chat-qr-done"));
    expect(onDone).toHaveBeenCalled();
    expect(triggerJob).not.toHaveBeenCalled();
  });

  it("success 'Yes — trigger first sync' calls the cur_ingestion job", async () => {
    registerAccount.mockResolvedValue({
      account: { id: "abc", alias: "Test" },
      validation: {
        overall_status: "connected",
        steps: [{ name: "credentials", label: "Verify credentials", status: "pass" }],
      },
    });
    render(<Harness />);
    await walkToApply();
    await screen.findByTestId("chat-launch-url");
    fireEvent.click(screen.getByTestId("chat-qr-applied"));
    fireEvent.click(await screen.findByTestId("chat-qr-stack-done"));
    for (const [id, v] of [
      ["chat-output-awsAccountId", "1"],
      ["chat-output-roleArn", "r"],
      ["chat-output-awsAccessKeyId", "a"],
      ["chat-output-awsSecretAccessKey", "s"],
      ["chat-output-externalId", "e"],
    ]) {
      fireEvent.change(await screen.findByTestId(id), { target: { value: v } });
    }
    fireEvent.click(screen.getByTestId("chat-outputs-submit"));
    await screen.findByTestId("chat-msg-success");
    fireEvent.click(screen.getByTestId("chat-qr-trigger"));
    await waitFor(() =>
      expect(triggerJob).toHaveBeenCalledWith("cur_ingestion"),
    );
  });
});
