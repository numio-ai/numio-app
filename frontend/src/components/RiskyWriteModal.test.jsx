import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import RiskyWriteModal from "./RiskyWriteModal";

const PREVIEW = {
  risky: true,
  reasons: ["1 affected resource(s) are tagged as production"],
  affected_resources: [
    { resource_id: "r1", arn: "arn:aws:ec2:::i-1", name: "payments-prod", env: "production", monthly_cost: 842 },
    { resource_id: "r2", arn: "arn:aws:ec2:::i-2", name: "checkout-prod", env: "prod", monthly_cost: 412 },
  ],
};

function renderModal(props = {}) {
  return render(
    <RiskyWriteModal
      tagKey="team"
      value="payments"
      preview={PREVIEW}
      busy={props.busy || false}
      onConfirm={props.onConfirm || vi.fn()}
      onCancel={props.onCancel || vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RiskyWriteModal — content driven by preview", () => {
  it("lists every risk reason", () => {
    renderModal();
    expect(screen.getByTestId("rwm-reasons")).toHaveTextContent(/tagged as production/);
  });

  it("renders each affected resource with its monthly cost", () => {
    renderModal();
    const r1 = screen.getByTestId("rwm-affected-r1");
    expect(r1).toHaveTextContent("payments-prod");
    expect(r1).toHaveTextContent("$842/mo");
    expect(screen.getByTestId("rwm-affected-r2")).toHaveTextContent("$412/mo");
  });

  it("shows the set change for a value", () => {
    renderModal();
    expect(screen.getByTestId("risky-write-modal")).toHaveTextContent(/Set team = payments/);
  });

  it("shows a remove change when value is null", () => {
    render(<RiskyWriteModal tagKey="owner" value={null} preview={PREVIEW} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId("risky-write-modal")).toHaveTextContent(/Remove tag/);
  });
});

describe("RiskyWriteModal — confirm / cancel", () => {
  it("confirm invokes onConfirm", () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });
    fireEvent.click(screen.getByTestId("rwm-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancel invokes onCancel without confirming", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderModal({ onConfirm, onCancel });
    fireEvent.click(screen.getByTestId("rwm-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape cancels when not busy", () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("busy disables confirm and shows Applying…", () => {
    const onConfirm = vi.fn();
    renderModal({ busy: true, onConfirm });
    const confirm = screen.getByTestId("rwm-confirm");
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent(/Applying/);
  });
});
