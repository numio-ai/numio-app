import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RecommendationsPage from "./RecommendationsPage";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recommendations" element={<RecommendationsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("RecommendationsPage — initial render (A1)", () => {
  it("first card is expanded by default", () => {
    renderAt("/recommendations");
    expect(screen.getByTestId("rec-card-r-201")).toHaveAttribute("data-expanded", "true");
    expect(screen.getByTestId("rec-card-r-198")).toHaveAttribute("data-expanded", "false");
  });

  it("renders all five evidence sections in the expanded card", () => {
    renderAt("/recommendations");
    expect(screen.getByTestId("rec-section-signals-r-201")).toBeInTheDocument();
    expect(screen.getByTestId("rec-section-affected-r-201")).toBeInTheDocument();
    expect(screen.getByTestId("rec-section-what-r-201")).toBeInTheDocument();
    expect(screen.getByTestId("rec-section-exclusions-r-201")).toBeInTheDocument();
    expect(screen.getByTestId("rec-section-risk-r-201")).toBeInTheDocument();
  });
});

describe("RecommendationsPage — expand/collapse (A2)", () => {
  it("clicking a collapsed card expands it", () => {
    renderAt("/recommendations");
    fireEvent.click(screen.getByTestId("rec-card-header-r-198"));
    expect(screen.getByTestId("rec-card-r-198")).toHaveAttribute("data-expanded", "true");
  });

  it("clicking an expanded card collapses it", () => {
    renderAt("/recommendations");
    fireEvent.click(screen.getByTestId("rec-card-header-r-201"));
    expect(screen.getByTestId("rec-card-r-201")).toHaveAttribute("data-expanded", "false");
  });

  it("multiple cards may be expanded simultaneously", () => {
    renderAt("/recommendations");
    fireEvent.click(screen.getByTestId("rec-card-header-r-198"));
    expect(screen.getByTestId("rec-card-r-201")).toHaveAttribute("data-expanded", "true");
    expect(screen.getByTestId("rec-card-r-198")).toHaveAttribute("data-expanded", "true");
  });
});

describe("RecommendationsPage — Affected resources link (A3)", () => {
  it("View all link target includes the recommendation id", () => {
    renderAt("/recommendations");
    const link = screen.getByTestId("rec-view-resources-r-201");
    expect(link).toHaveAttribute("href", "/resources?rec=r-201");
  });
});

describe("RecommendationsPage — single Rescan button (A4)", () => {
  it("renders one Rescan button with last-time annotation", () => {
    renderAt("/recommendations");
    const btn = screen.getByTestId("rec-rescan-button");
    expect(btn).toHaveTextContent(/Rescan/);
    expect(btn).toHaveTextContent(/last 2h ago/);
    expect(screen.queryByText(/^Refresh$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate new/i)).not.toBeInTheDocument();
  });
});

describe("RecommendationsPage — Zombie Hunter saved view (A5)", () => {
  it("selecting Zombie Hunter filters to Idle resource + Orphan reclaim categories", () => {
    renderAt("/recommendations");
    fireEvent.click(screen.getByTestId("rec-views-button"));
    fireEvent.click(screen.getByTestId("rec-view-row-zombie"));
    expect(screen.getByTestId("rec-card-r-201")).toBeInTheDocument(); // Idle resource
    expect(screen.getByTestId("rec-card-r-192")).toBeInTheDocument(); // Orphan reclaim
    expect(screen.queryByTestId("rec-card-r-198")).not.toBeInTheDocument(); // PR cost regression
    expect(screen.queryByTestId("rec-card-r-195")).not.toBeInTheDocument(); // Model switch
  });

  it("URL ?view=zombie restores the Zombie Hunter filter", () => {
    renderAt("/recommendations?view=zombie");
    expect(screen.getByTestId("rec-views-button")).toHaveTextContent(/Zombie Hunter/);
    expect(screen.queryByTestId("rec-card-r-198")).not.toBeInTheDocument();
  });
});

describe("RecommendationsPage — Apply once (A6)", () => {
  it("clicking Apply once shows a toast with savings amount", () => {
    renderAt("/recommendations");
    fireEvent.click(screen.getByTestId("rec-apply-once-r-201"));
    const toast = screen.getByTestId("rec-toast");
    expect(toast).toHaveTextContent(/Applied/);
    expect(toast).toHaveTextContent(/\$11,820/);
    expect(toast).toHaveTextContent(/reversible for 7 days/);
  });
});

describe("RecommendationsPage — Send to Autopilot (A7)", () => {
  it("clicking opens the confirmation modal", () => {
    renderAt("/recommendations");
    fireEvent.click(screen.getByTestId("rec-send-autopilot-r-201"));
    expect(screen.getByTestId("send-to-autopilot-modal")).toBeInTheDocument();
  });
});

describe("RecommendationsPage — Manual remediation (A8)", () => {
  it("renders the code block when the recommendation has a CLI snippet", () => {
    renderAt("/recommendations");
    expect(screen.getByTestId("rec-section-manual-r-201")).toBeInTheDocument();
  });

  it("is absent when no CLI snippet is provided", () => {
    renderAt("/recommendations");
    fireEvent.click(screen.getByTestId("rec-card-header-r-198"));
    expect(screen.queryByTestId("rec-section-manual-r-198")).not.toBeInTheDocument();
  });
});
