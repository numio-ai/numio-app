import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../api/dataExplorer", () => ({
  runQuery: vi.fn(),
  listSavedQueries: vi.fn(),
  createSavedQuery: vi.fn(),
  updateSavedQuery: vi.fn(),
  deleteSavedQuery: vi.fn(),
  DataExplorerError: class extends Error {},
}));

import {
  runQuery,
  listSavedQueries,
  createSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
} from "../../api/dataExplorer";
import DataExplorerPage from "./DataExplorerPage";

const SAMPLE_QUERY = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Workspaces",
  sql: "SELECT slug FROM workspaces",
  description: "Quick lookup",
  created_by_user_id: "u1",
  updated_by_user_id: "u1",
  created_at: "2026-05-04T00:00:00Z",
  updated_at: "2026-05-04T00:00:00Z",
};

describe("DataExplorerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSavedQueries.mockResolvedValue({ items: [], count: 0 });
  });

  it("runs a query and renders the result table", async () => {
    runQuery.mockResolvedValue({
      columns: ["slug"],
      rows: [["default"]],
      row_count: 1,
      truncated: false,
      elapsed_ms: 4,
    });
    render(<DataExplorerPage />);
    await waitFor(() => expect(listSavedQueries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));

    await waitFor(() => expect(runQuery).toHaveBeenCalled());
    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(screen.getByText(/1 row · 4 ms/)).toBeInTheDocument();
  });

  it("renders backend error message and HTTP hint on failure", async () => {
    const err = new Error('relation "nope" does not exist');
    err.status = 400;
    err.errorCode = "INVALID_SQL";
    runQuery.mockRejectedValue(err);

    render(<DataExplorerPage />);
    await waitFor(() => expect(listSavedQueries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));

    const alert = await screen.findByTestId("dx-error");
    expect(alert).toHaveTextContent("400");
    expect(alert).toHaveTextContent("Invalid SQL");
    expect(alert).toHaveTextContent("INVALID_SQL");
    expect(alert).toHaveTextContent('relation "nope" does not exist');
  });

  it("shows the truncation banner when the response is truncated", async () => {
    runQuery.mockResolvedValue({
      columns: ["i"],
      rows: [[1], [2], [3]],
      row_count: 3,
      truncated: true,
      elapsed_ms: 7,
    });
    render(<DataExplorerPage />);
    await waitFor(() => expect(listSavedQueries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /^Run$/ }));

    expect(await screen.findByRole("status")).toHaveTextContent(/truncated/i);
  });

  it("loads, saves and runs a saved query", async () => {
    listSavedQueries
      .mockResolvedValueOnce({ items: [], count: 0 })
      .mockResolvedValueOnce({ items: [SAMPLE_QUERY], count: 1 });
    createSavedQuery.mockResolvedValue(SAMPLE_QUERY);
    runQuery.mockResolvedValue({
      columns: ["slug"],
      rows: [["default"]],
      row_count: 1,
      truncated: false,
      elapsed_ms: 2,
    });

    render(<DataExplorerPage />);
    await waitFor(() => expect(listSavedQueries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /save current query/i }));
    fireEvent.change(screen.getByLabelText("Saved query name"), {
      target: { value: "Workspaces" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));

    await waitFor(() => expect(createSavedQuery).toHaveBeenCalled());
    expect(createSavedQuery.mock.calls[0][0]).toMatchObject({ name: "Workspaces" });

    await screen.findByText("Workspaces");

    fireEvent.click(screen.getByRole("button", { name: /run workspaces/i }));
    await waitFor(() =>
      expect(runQuery).toHaveBeenCalledWith("SELECT slug FROM workspaces"),
    );
  });

  it("renames a saved query", async () => {
    listSavedQueries
      .mockResolvedValueOnce({ items: [SAMPLE_QUERY], count: 1 })
      .mockResolvedValueOnce({
        items: [{ ...SAMPLE_QUERY, name: "Renamed" }],
        count: 1,
      });
    updateSavedQuery.mockResolvedValue({ ...SAMPLE_QUERY, name: "Renamed" });

    render(<DataExplorerPage />);
    await screen.findByText("Workspaces");

    fireEvent.click(screen.getByRole("button", { name: /rename workspaces/i }));
    const input = screen.getByLabelText(/rename workspaces/i);
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.submit(input.closest("form"));

    await waitFor(() =>
      expect(updateSavedQuery).toHaveBeenCalledWith(SAMPLE_QUERY.id, { name: "Renamed" }),
    );
    await screen.findByText("Renamed");
  });

  it("deletes a saved query after confirmation", async () => {
    listSavedQueries
      .mockResolvedValueOnce({ items: [SAMPLE_QUERY], count: 1 })
      .mockResolvedValueOnce({ items: [], count: 0 });
    deleteSavedQuery.mockResolvedValue(null);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DataExplorerPage />);
    await screen.findByText("Workspaces");

    fireEvent.click(screen.getByRole("button", { name: /delete workspaces/i }));
    await waitFor(() => expect(deleteSavedQuery).toHaveBeenCalledWith(SAMPLE_QUERY.id));
    await waitFor(() => expect(screen.queryByText("Workspaces")).not.toBeInTheDocument());

    confirmSpy.mockRestore();
  });
});
