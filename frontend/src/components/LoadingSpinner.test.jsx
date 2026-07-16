import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingSpinner from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders default loading message", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<LoadingSpinner message="Fetching data…" />);
    expect(screen.getByText("Fetching data…")).toBeInTheDocument();
  });
});
