import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useIngestionStatusMock = vi.fn();
vi.mock("../context/IngestionStatusContext", () => ({
  useIngestionStatus: () => useIngestionStatusMock(),
}));

import PipelineDiagnosticCard from "./PipelineDiagnosticCard";

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <PipelineDiagnosticCard dataSource="cur" {...props} />
    </MemoryRouter>
  );
}

function setIngestion({ statuses = [], accounts = [] } = {}) {
  useIngestionStatusMock.mockReturnValue({
    statuses,
    accounts,
    loading: false,
    error: null,
    lastFetchedAt: new Date(),
    refresh: vi.fn(),
  });
}

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PipelineDiagnosticCard", () => {
  it("renders fallback when synced state is reached", () => {
    setIngestion({
      accounts: [{ aws_account_id: "111", alias: "Prod", status: "connected", created_at: hoursAgo(100) }],
      statuses: [
        {
          account_id: "111",
          data_source: "cur",
          last_sync_at: hoursAgo(1),
          last_status: "success",
          record_count: 100,
        },
      ],
    });
    renderCard({ fallback: <span>fallback-used</span> });
    expect(screen.getByText("fallback-used")).toBeInTheDocument();
  });

  it("renders no_account stage with Connect CTA", () => {
    setIngestion({ accounts: [], statuses: [] });
    renderCard({ fallback: <span>fb</span> });
    expect(screen.getByText(/Connect an AWS account/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Connect AWS account/i })).toHaveAttribute(
      "href",
      "/settings?tab=integrations"
    );
  });

  it("renders account_invalid stage with Fix connection CTA", () => {
    setIngestion({
      accounts: [
        { aws_account_id: "111", alias: "Prod", status: "disconnected", created_at: hoursAgo(100) },
      ],
      statuses: [],
    });
    renderCard();
    expect(screen.getByText(/Connection to your AWS account has a problem/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fix connection/i })).toBeInTheDocument();
  });

  it("renders awaiting_first_export stage for freshly-connected account", () => {
    setIngestion({
      accounts: [
        { aws_account_id: "111", alias: "New", status: "connected", created_at: hoursAgo(2) },
      ],
      statuses: [],
    });
    renderCard();
    expect(screen.getByText(/Waiting for your first CUR export/i)).toBeInTheDocument();
  });

  it("renders running stage when a job is running", () => {
    setIngestion({
      accounts: [{ aws_account_id: "111", alias: "Prod", status: "connected", created_at: hoursAgo(100) }],
      statuses: [
        { account_id: "111", data_source: "cur", last_sync_at: null, last_status: "running", record_count: 0 },
      ],
    });
    renderCard();
    expect(screen.getByText(/Ingestion is running right now/i)).toBeInTheDocument();
  });

  it("renders failed stage with a View details link", () => {
    setIngestion({
      accounts: [{ aws_account_id: "111", alias: "Prod", status: "connected", created_at: hoursAgo(100) }],
      statuses: [
        { account_id: "111", data_source: "cur", last_sync_at: hoursAgo(1), last_status: "failed", record_count: 0 },
      ],
    });
    renderCard();
    expect(screen.getByText(/Most recent ingestion run failed/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View details/i })).toHaveAttribute("href", "/ingestion");
  });

  it("renders 'Checking data pipeline…' while the provider is loading", () => {
    useIngestionStatusMock.mockReturnValue({
      statuses: null,
      accounts: [],
      loading: true,
      error: null,
      lastFetchedAt: null,
      refresh: vi.fn(),
    });
    renderCard();
    expect(screen.getByText(/Checking data pipeline/i)).toBeInTheDocument();
  });
});
