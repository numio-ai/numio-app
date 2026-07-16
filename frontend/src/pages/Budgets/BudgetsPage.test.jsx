import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BudgetsPage, { deriveStatus } from "./BudgetsPage";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/budgets" element={<BudgetsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BudgetsPage — basics (A1, A6)", () => {
  it("renders the page", () => {
    renderAt("/budgets");
    expect(screen.getByTestId("budgets-page")).toBeInTheDocument();
  });

  it("subtitle has the four signals", () => {
    renderAt("/budgets");
    const subtitle = screen.getByTestId("budgets-subtitle");
    expect(subtitle).toHaveTextContent(/spent of/);
    expect(subtitle).toHaveTextContent(/over/);
    expect(subtitle).toHaveTextContent(/at risk/);
    expect(subtitle).toHaveTextContent(/day 15 of 31/);
  });
});

describe("BudgetsPage — pacing tick (A2, A3)", () => {
  it("every card has a tick at the expected-day position", () => {
    renderAt("/budgets");
    const ticks = screen.getAllByTestId("budget-pacing-tick");
    expect(ticks.length).toBeGreaterThan(0);
    const expectedPct = Math.round((15 / 31) * 100);
    for (const t of ticks) {
      expect(t).toHaveAttribute("data-expected-pct", String(expectedPct));
    }
  });

  it("each card shows the 'Expected at day N: X%' annotation", () => {
    renderAt("/budgets");
    const ann = screen.getByTestId("budget-annotation-team-eng");
    expect(ann).toHaveTextContent(/Expected at day 15:/);
    expect(ann).toHaveTextContent(/%/);
  });

  it("annotation includes ahead/behind drift label when drift > ±5pp", () => {
    renderAt("/budgets");
    const mlAnn = screen.getByTestId("budget-annotation-team-ml");
    expect(mlAnn).toHaveTextContent(/ahead/);
  });
});

describe("BudgetsPage — status border colors (A4)", () => {
  it("on-track card carries data-status='on-track'", () => {
    renderAt("/budgets");
    expect(screen.getByTestId("budget-card-team-eng")).toHaveAttribute("data-status", "on-track");
  });

  it("at-risk card carries data-status='at-risk'", () => {
    renderAt("/budgets");
    expect(screen.getByTestId("budget-card-team-payments")).toHaveAttribute("data-status", "at-risk");
  });

  it("over card carries data-status='over'", () => {
    renderAt("/budgets");
    expect(screen.getByTestId("budget-card-team-ml")).toHaveAttribute("data-status", "over");
  });

  it("deriveStatus helper returns the right bucket", () => {
    expect(deriveStatus({ spent: 50, budget: 100 })).toBe("on-track");
    expect(deriveStatus({ spent: 86, budget: 100 })).toBe("at-risk");
    expect(deriveStatus({ spent: 100, budget: 100 })).toBe("over");
    expect(deriveStatus({ spent: 120, budget: 100 })).toBe("over");
  });
});

describe("BudgetsPage — toolbar (A5)", () => {
  it("renders Views, Share, Save as, Rescan, + New budget, and period selector", () => {
    renderAt("/budgets");
    expect(screen.getByTestId("budgets-views-button")).toBeInTheDocument();
    expect(screen.getByTestId("budgets-share")).toBeInTheDocument();
    expect(screen.getByTestId("budgets-rescan")).toBeInTheDocument();
    expect(screen.getByTestId("budgets-new")).toBeInTheDocument();
    expect(screen.getByTestId("budgets-period-selector")).toBeInTheDocument();
  });

  it("changing the period scales the displayed numbers", () => {
    renderAt("/budgets");
    const monthlySpent = screen.getByTestId("budgets-subtitle").textContent;
    fireEvent.click(screen.getByTestId("budgets-period-year"));
    const yearlySpent = screen.getByTestId("budgets-subtitle").textContent;
    expect(yearlySpent).not.toBe(monthlySpent);
  });

  it("selecting 'Teams at risk' view scopes the grid", () => {
    renderAt("/budgets");
    fireEvent.click(screen.getByTestId("budgets-views-button"));
    fireEvent.click(screen.getByTestId("budgets-view-row-at-risk"));
    expect(screen.queryByTestId("budget-card-team-eng")).not.toBeInTheDocument();
    expect(screen.getByTestId("budget-card-team-payments")).toBeInTheDocument();
    expect(screen.getByTestId("budget-card-team-ml")).toBeInTheDocument();
  });
});

describe("BudgetsPage — + New budget stub", () => {
  it("clicking opens a stub dialog", () => {
    renderAt("/budgets");
    fireEvent.click(screen.getByTestId("budgets-new"));
    expect(screen.getByTestId("budgets-new-stub")).toBeInTheDocument();
  });
});
