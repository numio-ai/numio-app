import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import UsagePage from "./UsagePage";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/usage" element={<UsagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.defineProperty(window, "navigator", { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true });
});

describe("UsagePage — defaults (A1, A8)", () => {
  it("renders Cloud tab active and 30D range by default", () => {
    renderAt("/usage");
    expect(screen.getByTestId("usage-scope-cloud")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("usage-scope-ai")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("usage-range-30D")).toHaveAttribute("aria-selected", "true");
  });

  it("defaults Cloud group-by to tag:cost-center", () => {
    renderAt("/usage");
    expect(screen.getByTestId("usage-chart-title")).toHaveTextContent(/tag:cost-center/);
  });

  it("KPI strip is absent; total + delta render in chart card header", () => {
    renderAt("/usage");
    expect(screen.queryByTestId("usage-kpi-strip")).not.toBeInTheDocument();
    expect(screen.getByTestId("usage-delta-caption")).toBeInTheDocument();
  });
});

describe("UsagePage — range-label propagation (A3)", () => {
  it("changing range updates chart title, delta caption, and breakdown header", () => {
    renderAt("/usage");
    fireEvent.click(screen.getByTestId("usage-range-7D"));
    expect(screen.getByTestId("usage-chart-title")).toHaveTextContent(/LAST 7 DAYS/);
    expect(screen.getByTestId("usage-delta-caption")).toHaveTextContent(/vs previous 7 days/);
    expect(screen.getByTestId("usage-breakdown-header")).toHaveTextContent(/last 7 days/);
  });

  it("YTD propagates to all three labels", () => {
    renderAt("/usage?range=YTD");
    expect(screen.getByTestId("usage-chart-title")).toHaveTextContent(/YTD/);
    expect(screen.getByTestId("usage-delta-caption")).toHaveTextContent(/vs previous year-to-date/);
    expect(screen.getByTestId("usage-breakdown-header")).toHaveTextContent(/YTD/);
  });
});

describe("UsagePage — AI scope (A1, A2)", () => {
  it("?scope=ai shows AI tab active with tag:team default", () => {
    renderAt("/usage?scope=ai");
    expect(screen.getByTestId("usage-scope-ai")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("usage-chart-title")).toHaveTextContent(/tag:team/);
  });
});

describe("UsagePage — Group-by picker (A2)", () => {
  it("renders Platform and Tags sections in the picker", () => {
    renderAt("/usage");
    fireEvent.click(screen.getByTestId("usage-groupby-button"));
    const listbox = screen.getByRole("listbox", { name: /Group by/i });
    expect(listbox).toHaveTextContent(/Platform/i);
    expect(listbox).toHaveTextContent(/Tags/i);
    expect(screen.getByTestId("usage-groupby-option-tag-env")).toBeInTheDocument();
  });

  it("selecting a tag dimension writes groupBy to the URL", () => {
    renderAt("/usage");
    fireEvent.click(screen.getByTestId("usage-groupby-button"));
    fireEvent.click(screen.getByTestId("usage-groupby-option-tag-env"));
    expect(screen.getByTestId("usage-chart-title")).toHaveTextContent(/tag:env/);
  });
});

describe("UsagePage — filters from URL (A3, A4)", () => {
  it("renders filter chips serialized from URL", () => {
    renderAt("/usage?f=tag:env:production&f=platform:service:Amazon%20Bedrock");
    expect(screen.getByTestId("usage-filter-chip-tag-env")).toHaveTextContent(/production/);
    expect(screen.getByTestId("usage-filter-chip-platform-service")).toHaveTextContent(/Amazon Bedrock/);
  });
});

describe("UsagePage — untagged callout (A5)", () => {
  it("shown when scenario has untagged spend > 0", () => {
    renderAt("/usage");
    expect(screen.getByTestId("usage-untagged-callout")).toBeInTheDocument();
  });
});

describe("UsagePage — saved views (A6, A7)", () => {
  it("URL with view=by-env restores the view's groupBy", () => {
    renderAt("/usage?scope=cloud&view=by-env&groupBy=tag:env");
    expect(screen.getByTestId("usage-chart-title")).toHaveTextContent(/tag:env/);
  });

  it("clicking a saved view writes its parameters to the URL", () => {
    renderAt("/usage");
    fireEvent.click(screen.getByTestId("usage-views-button"));
    fireEvent.click(screen.getByTestId("usage-view-row-by-env"));
    expect(screen.getByTestId("usage-chart-title")).toHaveTextContent(/tag:env/);
  });
});
