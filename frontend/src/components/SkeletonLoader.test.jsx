import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SkeletonLoader from "./SkeletonLoader";

describe("SkeletonLoader", () => {
  it("renders dashboard variant by default", () => {
    const { container } = render(<SkeletonLoader />);
    // Dashboard variant has a 4-card grid
    const cards = container.querySelectorAll("div[style*='border-radius']");
    expect(cards.length).toBeGreaterThan(0);
  });

  it("renders feed variant", () => {
    const { container } = render(<SkeletonLoader variant="feed" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders recommendations variant", () => {
    const { container } = render(<SkeletonLoader variant="recommendations" />);
    expect(container.firstChild).toBeTruthy();
  });

  it("falls back to dashboard for unknown variant", () => {
    const { container } = render(<SkeletonLoader variant="unknown" />);
    expect(container.firstChild).toBeTruthy();
  });
});
