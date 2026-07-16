import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the ingestion context so CostSourceLabel (when rendering the
// optional freshness segment) can render in a lightweight test env.
vi.mock("../context/IngestionStatusContext", () => ({
  useIngestionStatus: () => ({
    statuses: [
      {
        account_id: "111",
        data_source: "cur",
        last_sync_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        last_status: "success",
        record_count: 100,
      },
    ],
    accounts: [],
    loading: false,
    error: null,
    lastFetchedAt: new Date(),
    refresh: vi.fn(),
  }),
}));

import CostSourceLabel from "./CostSourceLabel";

function renderLabel(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("CostSourceLabel", () => {
  it("renders Actual for CUR source", () => {
    renderLabel(<CostSourceLabel source="cur" />);
    expect(screen.getByText("Actual")).toBeInTheDocument();
  });

  it("renders Estimated for estimated source", () => {
    renderLabel(<CostSourceLabel source="estimated" />);
    expect(screen.getByText("Estimated")).toBeInTheDocument();
  });

  it("defaults to Actual when no source provided", () => {
    renderLabel(<CostSourceLabel />);
    expect(screen.getByText("Actual")).toBeInTheDocument();
  });

  it("shows tooltip with data source explanation", () => {
    renderLabel(<CostSourceLabel source="cur" />);
    const badge = screen.getByText("Actual");
    expect(badge.title).toContain("Cost & Usage Report");
  });

  it("does not render freshness segment by default", () => {
    renderLabel(<CostSourceLabel source="cur" />);
    expect(screen.queryByText(/Updated/i)).not.toBeInTheDocument();
  });

  it("renders an Updated freshness link when showFreshness is true", () => {
    renderLabel(<CostSourceLabel source="cur" showFreshness />);
    const link = screen.getByRole("link", { name: /Updated/i });
    expect(link).toHaveAttribute("href", "/ingestion");
  });
});
