import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";

function ThrowError({ shouldThrow }) {
  if (shouldThrow) throw new Error("Test crash");
  return <div>Content loaded</div>;
}

describe("ErrorBoundary", () => {
  // Suppress React's console.error for error boundaries in tests
  const originalError = console.error;
  beforeEach(() => { console.error = vi.fn(); });
  afterEach(() => { console.error = originalError; });

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Content loaded")).toBeInTheDocument();
  });

  it("catches errors and shows recovery UI", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test crash")).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("resets error state when Try again is clicked", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;
    function MaybeThrow() {
      if (shouldThrow) throw new Error("Test crash");
      return <div>Content loaded</div>;
    }
    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Stop throwing before clicking retry
    shouldThrow = false;
    await user.click(screen.getByText("Try again"));

    expect(screen.getByText("Content loaded")).toBeInTheDocument();
  });
});
