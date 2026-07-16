import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies green style for success statuses", () => {
    const { container } = render(<StatusBadge status="on-track" />);
    const badge = container.querySelector(".badge-status");
    expect(badge.style.color).toBe("rgb(22, 163, 74)");
  });

  it("applies red style for critical statuses", () => {
    const { container } = render(<StatusBadge status="critical" />);
    const badge = container.querySelector(".badge-status");
    expect(badge.style.color).toBe("rgb(220, 38, 38)");
  });

  it("applies amber style for warning statuses", () => {
    const { container } = render(<StatusBadge status="warning" />);
    const badge = container.querySelector(".badge-status");
    expect(badge.style.color).toBe("rgb(217, 119, 6)");
  });

  it("falls back to neutral for unknown status", () => {
    const { container } = render(<StatusBadge status="unknown-status" />);
    const badge = container.querySelector(".badge-status");
    expect(badge.style.color).toBe("rgb(75, 85, 99)");
  });

  it("handles null/undefined status gracefully", () => {
    const { container } = render(<StatusBadge status={null} />);
    const badge = container.querySelector(".badge-status");
    expect(badge).toBeInTheDocument();
    expect(badge.style.color).toBe("rgb(75, 85, 99)");
  });
});
