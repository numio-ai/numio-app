import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const useIngestionStatusMock = vi.fn();
vi.mock("../context/IngestionStatusContext", () => ({
  useIngestionStatus: () => useIngestionStatusMock(),
}));

import FreshnessLabel from "./FreshnessLabel";

function setup({ statuses = [] } = {}) {
  useIngestionStatusMock.mockReturnValue({
    statuses,
    accounts: [],
    loading: false,
    error: null,
    lastFetchedAt: new Date(),
    refresh: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <FreshnessLabel dataSource="cur" />
    </MemoryRouter>
  );
}

describe("FreshnessLabel", () => {
  it("renders 'Not synced yet' when no data", () => {
    setup({ statuses: [] });
    expect(screen.getByText(/Not synced yet/i)).toBeInTheDocument();
  });

  it("renders relative time and links to /ingestion", () => {
    setup({
      statuses: [
        {
          account_id: "111",
          data_source: "cur",
          last_sync_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          last_status: "success",
          record_count: 100,
        },
      ],
    });
    const link = screen.getByRole("link", { name: /Updated.*for cur/i });
    expect(link).toHaveAttribute("href", "/ingestion");
    expect(link.textContent).toMatch(/Updated 3h ago/i);
  });

  it("turns amber when the data source is stale", () => {
    // Pick an hours-ago value well beyond STALE_THRESHOLD_HOURS
    setup({
      statuses: [
        {
          account_id: "111",
          data_source: "cur",
          last_sync_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          last_status: "success",
          record_count: 100,
        },
      ],
    });
    const link = screen.getByRole("link");
    expect(link.style.color).toBe("rgb(217, 119, 6)");
  });

  it("turns amber when the data source last failed", () => {
    setup({
      statuses: [
        {
          account_id: "111",
          data_source: "cur",
          last_sync_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          last_status: "failed",
          record_count: 0,
        },
      ],
    });
    const link = screen.getByRole("link");
    expect(link.style.color).toBe("rgb(217, 119, 6)");
  });
});
