import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const authMock = vi.fn();
vi.mock("../context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

import SendToAutopilotModal from "./SendToAutopilotModal";

const SAMPLE_REC = {
  id: "r-201",
  title: "Hibernate 142 idle dev/sandbox resources nightly",
  scope: "aws://dev/* + gcp://sandbox/*",
  saving: 11820,
  affectedCount: 142,
  signals: [
    "142 resources averaged <2% CPU for 14 consecutive nights.",
    "Last activity > 9 days; no PR pushes.",
  ],
  rule: [
    { kw: "WHEN", expr: "env IN (dev, sandbox)" },
    { kw: "DO", expr: "stop_instance" },
  ],
  safety: [
    "Reversible within 7 days.",
    "Idempotent.",
  ],
};

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="probe-path">{loc.pathname + loc.search}</div>;
}

function renderModal(props = {}) {
  authMock.mockReturnValue({ user: { email: "test@numio.local" } });
  return render(
    <MemoryRouter initialEntries={["/recommendations"]}>
      <SendToAutopilotModal
        recommendation={SAMPLE_REC}
        onApprove={props.onApprove || vi.fn()}
        onCancel={props.onCancel || vi.fn()}
      />
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SendToAutopilotModal — structure (A1)", () => {
  it("renders the five sections in order", () => {
    renderModal();
    expect(screen.getByTestId("stam-section-summary")).toBeInTheDocument();
    expect(screen.getByTestId("stam-section-evidence")).toBeInTheDocument();
    expect(screen.getByTestId("stam-section-rule")).toBeInTheDocument();
    expect(screen.getByTestId("stam-section-safety")).toBeInTheDocument();
    expect(screen.getByTestId("stam-dryrun-toggle")).toBeInTheDocument();
  });

  it("action summary shows title, $/mo saved, resource count, scope", () => {
    renderModal();
    const summary = screen.getByTestId("stam-section-summary");
    expect(summary).toHaveTextContent(/Hibernate 142 idle/);
    expect(summary).toHaveTextContent(/\$11,820\/mo/);
    expect(summary).toHaveTextContent(/142 resources/);
    expect(summary).toHaveTextContent(/aws:\/\/dev\/\*/);
  });
});

describe("SendToAutopilotModal — dry-run toggle (A2)", () => {
  it("is checked by default", () => {
    renderModal();
    expect(screen.getByTestId("stam-dryrun-toggle")).toBeChecked();
  });

  it("renders the (recommended) hint", () => {
    renderModal();
    expect(screen.getByText(/recommended/i)).toBeInTheDocument();
  });

  it("unchecks when clicked", () => {
    renderModal();
    fireEvent.click(screen.getByTestId("stam-dryrun-toggle"));
    expect(screen.getByTestId("stam-dryrun-toggle")).not.toBeChecked();
  });
});

describe("SendToAutopilotModal — Approve callback (A3)", () => {
  it("invokes onApprove with ruleId + dryRun + approvedBy", () => {
    const onApprove = vi.fn();
    renderModal({ onApprove });
    fireEvent.click(screen.getByTestId("stam-approve"));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledWith({
      ruleId: "r-201",
      dryRun: true,
      approvedBy: "test@numio.local",
    });
  });

  it("passes the un-checked dryRun value when toggled off", () => {
    const onApprove = vi.fn();
    renderModal({ onApprove });
    fireEvent.click(screen.getByTestId("stam-dryrun-toggle"));
    fireEvent.click(screen.getByTestId("stam-approve"));
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
  });

  it("falls back to 'unknown' approvedBy when no user", () => {
    authMock.mockReturnValue({ user: null });
    const onApprove = vi.fn();
    render(
      <MemoryRouter>
        <SendToAutopilotModal recommendation={SAMPLE_REC} onApprove={onApprove} onCancel={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId("stam-approve"));
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ approvedBy: "unknown" }));
  });
});

describe("SendToAutopilotModal — Open rule editor (A4)", () => {
  it("closes the modal and navigates to /autopilot?new=true&prefill=<recId>", () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.click(screen.getByTestId("stam-open-editor"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("probe-path")).toHaveTextContent("/autopilot?new=true&prefill=r-201");
  });
});

describe("SendToAutopilotModal — Cancel (A5)", () => {
  it("calls onCancel without invoking onApprove", () => {
    const onApprove = vi.fn();
    const onCancel = vi.fn();
    renderModal({ onApprove, onCancel });
    fireEvent.click(screen.getByTestId("stam-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("Escape key calls onCancel", () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
