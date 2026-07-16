import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../api/tagGovernance", () => ({
  previewTagApply: vi.fn(),
  applyTags: vi.fn(),
}));
vi.mock("../api/dashboard", () => ({
  getAuditActionEvent: vi.fn(),
}));

import ApplyTagModal from "./ApplyTagModal";
import { previewTagApply, applyTags } from "../api/tagGovernance";
import { getAuditActionEvent } from "../api/dashboard";

const NOT_RISKY = { risky: false, reasons: [], affected_resources: [] };
const RISKY = {
  risky: true,
  reasons: ["1 affected resource(s) are tagged as production"],
  affected_resources: [{ resource_id: "r1", arn: "arn:1", name: "prod-1", env: "production", monthly_cost: 900 }],
};

function renderModal(props = {}) {
  return render(
    <ApplyTagModal
      resourceIds={props.resourceIds || ["r1"]}
      onClose={props.onClose || vi.fn()}
      onApplied={props.onApplied || vi.fn()}
    />
  );
}

function fillForm({ key = "team", value = "payments" } = {}) {
  fireEvent.change(screen.getByTestId("atm-tag-key"), { target: { value: key } });
  if (value !== null) {
    fireEvent.change(screen.getByTestId("atm-value"), { target: { value } });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApplyTagModal — not-risky apply", () => {
  it("applies directly (no risky modal) and shows a success result", async () => {
    previewTagApply.mockResolvedValue(NOT_RISKY);
    applyTags.mockResolvedValue({
      event_id: "e1",
      status: "success",
      summary: { item_count: 1, success_count: 1, failure_count: 0 },
    });
    const onApplied = vi.fn();
    renderModal({ onApplied });
    fillForm();
    fireEvent.click(screen.getByTestId("atm-submit"));

    const result = await screen.findByTestId("atm-result");
    expect(result).toHaveAttribute("data-status", "success");
    expect(result).toHaveTextContent(/Applied to 1 resource/);
    expect(screen.queryByTestId("risky-write-modal")).not.toBeInTheDocument();
    expect(applyTags).toHaveBeenCalledWith(expect.objectContaining({ confirmRisky: false }));
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("sends value=null in remove mode", async () => {
    previewTagApply.mockResolvedValue(NOT_RISKY);
    applyTags.mockResolvedValue({ event_id: "e1", status: "success", summary: { item_count: 1, success_count: 1, failure_count: 0 } });
    renderModal();
    fireEvent.change(screen.getByTestId("atm-tag-key"), { target: { value: "owner" } });
    fireEvent.click(screen.getByTestId("atm-remove"));
    fireEvent.click(screen.getByTestId("atm-submit"));

    await screen.findByTestId("atm-result");
    const changes = previewTagApply.mock.calls[0][0];
    expect(changes[0].value).toBeNull();
    expect(changes[0].tag_key).toBe("owner");
  });
});

describe("ApplyTagModal — risky gate", () => {
  it("opens RiskyWriteModal on risky=true, then applies with confirm_risky on confirm", async () => {
    previewTagApply.mockResolvedValue(RISKY);
    applyTags.mockResolvedValue({ event_id: "e2", status: "success", summary: { item_count: 1, success_count: 1, failure_count: 0 } });
    renderModal();
    fillForm({ key: "team", value: "payments" });
    fireEvent.click(screen.getByTestId("atm-submit"));

    const risky = await screen.findByTestId("risky-write-modal");
    expect(risky).toHaveTextContent(/tagged as production/);
    expect(applyTags).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("rwm-confirm"));
    await screen.findByTestId("atm-result");
    expect(applyTags).toHaveBeenCalledWith(expect.objectContaining({ confirmRisky: true }));
  });

  it("cancelling the risky modal returns to the form without applying", async () => {
    previewTagApply.mockResolvedValue(RISKY);
    renderModal();
    fillForm();
    fireEvent.click(screen.getByTestId("atm-submit"));
    await screen.findByTestId("risky-write-modal");
    fireEvent.click(screen.getByTestId("rwm-cancel"));
    expect(await screen.findByTestId("atm-submit")).toBeInTheDocument();
    expect(applyTags).not.toHaveBeenCalled();
  });
});

describe("ApplyTagModal — partial failure", () => {
  it("lists failed resources with AWS error codes from the action event", async () => {
    previewTagApply.mockResolvedValue(NOT_RISKY);
    applyTags.mockResolvedValue({
      event_id: "e3",
      status: "partial_failure",
      summary: { item_count: 2, success_count: 1, failure_count: 1 },
    });
    getAuditActionEvent.mockResolvedValue({
      id: "e3",
      status: "partial_failure",
      items: [
        { id: "it1", status: "failure", target_id: "arn:aws:ec2:::i-bad", error_code: "AccessDenied", error_message: "not allowed" },
        { id: "it2", status: "success", target_id: "arn:aws:ec2:::i-ok" },
      ],
    });
    renderModal({ resourceIds: ["r1", "r2"] });
    fillForm();
    fireEvent.click(screen.getByTestId("atm-submit"));

    const result = await screen.findByTestId("atm-result");
    expect(result).toHaveAttribute("data-status", "partial_failure");
    expect(result).toHaveTextContent(/1 of 2 change\(s\) failed/);
    expect(getAuditActionEvent).toHaveBeenCalledWith("e3");
    const failed = await screen.findByTestId("atm-failed-it1");
    expect(failed).toHaveTextContent("arn:aws:ec2:::i-bad");
    expect(failed).toHaveTextContent(/AccessDenied/);
    expect(screen.queryByTestId("atm-failed-it2")).not.toBeInTheDocument();
  });
});

describe("ApplyTagModal — client-side guards", () => {
  it("rejects an empty tag key without calling the API", () => {
    renderModal();
    fireEvent.click(screen.getByTestId("atm-submit"));
    expect(screen.getByTestId("atm-error")).toHaveTextContent(/tag key/i);
    expect(previewTagApply).not.toHaveBeenCalled();
  });

  it("rejects an empty value when not removing", () => {
    renderModal();
    fireEvent.change(screen.getByTestId("atm-tag-key"), { target: { value: "team" } });
    fireEvent.click(screen.getByTestId("atm-submit"));
    expect(screen.getByTestId("atm-error")).toHaveTextContent(/value/i);
    expect(previewTagApply).not.toHaveBeenCalled();
  });

  it("rejects more than 100 resources without calling the API", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `r${i}`);
    renderModal({ resourceIds: ids });
    fillForm();
    fireEvent.click(screen.getByTestId("atm-submit"));
    expect(screen.getByTestId("atm-error")).toHaveTextContent(/100 or fewer/);
    expect(previewTagApply).not.toHaveBeenCalled();
  });
});

describe("ApplyTagModal — preview error", () => {
  it("surfaces a preview error and stays on the form", async () => {
    previewTagApply.mockRejectedValue(new Error("API 500: boom"));
    renderModal();
    fillForm();
    fireEvent.click(screen.getByTestId("atm-submit"));
    await waitFor(() => expect(screen.getByTestId("atm-error")).toHaveTextContent(/boom/));
    expect(applyTags).not.toHaveBeenCalled();
  });
});
