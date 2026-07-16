import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorMessage from "./ErrorMessage";

describe("ErrorMessage", () => {
  it("renders the error message", () => {
    render(<ErrorMessage message="Something failed" />);
    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });

  it("shows friendly fallback for generic server errors", () => {
    render(<ErrorMessage message="An unexpected error occurred" />);
    expect(screen.getByText(/backend may not have data yet/)).toBeInTheDocument();
  });

  it("shows default message when none provided", () => {
    render(<ErrorMessage />);
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    render(<ErrorMessage message="Error" onRetry={() => {}} />);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("does not render retry button without onRetry", () => {
    render(<ErrorMessage message="Error" />);
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorMessage message="Error" onRetry={onRetry} />);
    await user.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
