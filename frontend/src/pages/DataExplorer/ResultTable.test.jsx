import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultTable from "./ResultTable";

describe("ResultTable", () => {
  it("renders columns and rows", () => {
    render(
      <ResultTable
        result={{
          columns: ["slug", "name"],
          rows: [
            ["default", "Default"],
            ["other", "Other"],
          ],
          row_count: 2,
          truncated: false,
          elapsed_ms: 12,
        }}
      />,
    );
    expect(screen.getByText("slug")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByText(/2 rows · 12 ms/)).toBeInTheDocument();
  });

  it("renders the empty state when no rows", () => {
    render(
      <ResultTable
        result={{ columns: ["x"], rows: [], row_count: 0, truncated: false, elapsed_ms: 5 }}
      />,
    );
    expect(screen.getByText("No rows returned.")).toBeInTheDocument();
  });

  it("renders truncation banner when truncated", () => {
    render(
      <ResultTable
        result={{
          columns: ["x"],
          rows: [[1], [2], [3]],
          row_count: 3,
          truncated: true,
          elapsed_ms: 9,
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/truncated to 3 rows/i);
  });

  it("renders NULL for null cells", () => {
    render(
      <ResultTable
        result={{
          columns: ["x"],
          rows: [[null]],
          row_count: 1,
          truncated: false,
          elapsed_ms: 1,
        }}
      />,
    );
    expect(screen.getByText("NULL")).toBeInTheDocument();
  });
});
