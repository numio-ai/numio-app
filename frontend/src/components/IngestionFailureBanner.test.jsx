import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useIngestionStatusMock = vi.fn();
vi.mock("../context/IngestionStatusContext", () => ({
  useIngestionStatus: () => useIngestionStatusMock(),
}));

import IngestionFailureBanner from "./IngestionFailureBanner";

function setup({ statuses = [], accounts = [] } = {}) {
  useIngestionStatusMock.mockReturnValue({
    statuses,
    accounts,
    loading: false,
    error: null,
    lastFetchedAt: new Date(),
    refresh: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <IngestionFailureBanner />
    </MemoryRouter>
  );
}

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

const failingStatus = (account_id, workspace_id, last_sync_at, error_details = "AccessDenied") => ({
  workspace_id,
  account_id,
  data_source: "cur",
  last_sync_at,
  last_status: "failed",
  record_count: 0,
  error_details,
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("IngestionFailureBanner", () => {
  it("renders nothing when pipeline is healthy", () => {
    setup({
      accounts: [{ aws_account_id: "111", alias: "Prod", status: "connected" }],
      statuses: [
        {
          account_id: "111",
          data_source: "cur",
          last_sync_at: oneHourAgo,
          last_status: "success",
          record_count: 100,
          workspace_id: "ws1",
        },
      ],
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders when any account has failed, with the failing-count phrasing", () => {
    setup({
      accounts: [
        { aws_account_id: "111", alias: "Prod", status: "connected" },
        { aws_account_id: "222", alias: "Dev", status: "connected" },
      ],
      statuses: [
        failingStatus("111", "ws1", oneHourAgo),
        failingStatus("222", "ws1", tenMinAgo),
      ],
    });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Data ingestion failing/i);
    expect(alert).toHaveTextContent(/2 accounts failing/i);
    expect(screen.getByRole("link", { name: /View details/i })).toHaveAttribute("href", "/ingestion");
  });

  it("dismissal persists for the same failure key", () => {
    setup({
      accounts: [{ aws_account_id: "111", alias: "Prod", status: "connected" }],
      statuses: [failingStatus("111", "ws1", oneHourAgo)],
    });
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Same failure on re-render → stays hidden
    const { queryByRole } = render(
      <MemoryRouter>
        <IngestionFailureBanner />
      </MemoryRouter>
    );
    expect(queryByRole("alert")).not.toBeInTheDocument();
  });

  it("re-shows the banner when a new failure (later timestamp) occurs after dismissal", () => {
    setup({
      accounts: [{ aws_account_id: "111", alias: "Prod", status: "connected" }],
      statuses: [failingStatus("111", "ws1", oneHourAgo)],
    });
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // New failure with a more-recent timestamp
    setup({
      accounts: [{ aws_account_id: "111", alias: "Prod", status: "connected" }],
      statuses: [failingStatus("111", "ws1", tenMinAgo)],
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
