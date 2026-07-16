import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useIngestionStatusMock = vi.fn();
const useAutopilotStatusMock = vi.fn();

vi.mock("../context/IngestionStatusContext", () => ({
  useIngestionStatus: () => useIngestionStatusMock(),
}));

vi.mock("../hooks/useAutopilotStatus", () => ({
  default: () => useAutopilotStatusMock(),
}));

import SystemPill from "./SystemPill";

function setup({ data = "synced", autopilot = "active", pausedAll = false, activeRuleCount = 7 } = {}) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const failed = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  let statuses;
  let accounts = [{ aws_account_id: "111", alias: "Prod" }];

  switch (data) {
    case "synced":
      statuses = [{ account_id: "111", data_source: "cur", last_sync_at: oneHourAgo, last_status: "success", record_count: 1000 }];
      break;
    case "syncing":
      statuses = [{ account_id: "111", data_source: "cur", last_sync_at: oneHourAgo, last_status: "running" }];
      break;
    case "delayed":
      const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      statuses = [{ account_id: "111", data_source: "cur", last_sync_at: old, last_status: "success" }];
      break;
    case "issue":
      statuses = [{ account_id: "111", data_source: "cur", last_sync_at: failed, last_status: "failed", error_details: "AccessDenied" }];
      break;
    case "not_configured":
      statuses = [];
      accounts = [];
      break;
    default:
      statuses = [];
  }

  useIngestionStatusMock.mockReturnValue({ statuses, accounts });
  useAutopilotStatusMock.mockReturnValue({ state: autopilot, activeRuleCount, pausedAll });

  return render(
    <MemoryRouter>
      <SystemPill />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SystemPill — color mapping (A2)", () => {
  const cases = [
    { name: "synced + active → green", data: "synced", autopilot: "active", expected: "ok" },
    { name: "synced + disabled → green", data: "synced", autopilot: "disabled", expected: "ok" },
    { name: "syncing + active → green", data: "syncing", autopilot: "active", expected: "ok" },
    { name: "synced + paused → amber", data: "synced", autopilot: "paused", expected: "degraded" },
    { name: "delayed + active → amber", data: "delayed", autopilot: "active", expected: "degraded" },
    { name: "not_configured + active → amber", data: "not_configured", autopilot: "active", expected: "degraded" },
    { name: "issue + active → red", data: "issue", autopilot: "active", expected: "failed" },
    { name: "issue + paused → red", data: "issue", autopilot: "paused", expected: "failed" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      setup({ data: c.data, autopilot: c.autopilot });
      const pill = screen.getByTestId("system-pill");
      expect(pill.getAttribute("data-overall")).toBe(c.expected);
    });
  }
});

describe("SystemPill — tooltip (A3)", () => {
  it("title attribute summarises both signals", () => {
    setup({ data: "synced", autopilot: "active" });
    const pill = screen.getByTestId("system-pill");
    expect(pill).toHaveAttribute("title", expect.stringMatching(/Data synced.*Autopilot active/i));
  });
});

describe("SystemPill — popover (A4)", () => {
  it("clicking opens the popover with both rows", () => {
    setup({ data: "synced", autopilot: "active" });
    fireEvent.click(screen.getByTestId("system-pill"));
    expect(screen.getByTestId("system-pill-row-data")).toBeInTheDocument();
    expect(screen.getByTestId("system-pill-row-autopilot")).toBeInTheDocument();
  });

  it("data row renders status text and ingestion deep link", () => {
    setup({ data: "synced", autopilot: "active" });
    fireEvent.click(screen.getByTestId("system-pill"));
    const link = screen.getByTestId("system-pill-ingestion-link");
    expect(link).toHaveAttribute("href", "/ingestion");
    expect(screen.getByTestId("system-pill-row-data")).toHaveTextContent(/Data sync/i);
  });

  it("autopilot row renders rule count and autopilot deep link", () => {
    setup({ data: "synced", autopilot: "active", activeRuleCount: 7 });
    fireEvent.click(screen.getByTestId("system-pill"));
    const link = screen.getByTestId("system-pill-autopilot-link");
    expect(link).toHaveAttribute("href", "/autopilot");
    expect(screen.getByTestId("system-pill-row-autopilot")).toHaveTextContent(/7 active rules/i);
  });

  it("autopilot row shows paused-all state when pausedAll = true", () => {
    setup({ data: "synced", pausedAll: true });
    fireEvent.click(screen.getByTestId("system-pill"));
    expect(screen.getByTestId("system-pill-row-autopilot")).toHaveTextContent(/Paused.*all/i);
  });

  it("popover closes on Escape", () => {
    setup({ data: "synced", autopilot: "active" });
    fireEvent.click(screen.getByTestId("system-pill"));
    expect(screen.getByTestId("system-pill-row-data")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("system-pill-row-data")).not.toBeInTheDocument();
  });
});
