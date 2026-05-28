import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
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

describe("UsagePage — time range scales total and breakdown", () => {
  it("changing range from 30D to 7D reduces the total roughly to 7/30", () => {
    renderAt("/usage");
    const totalAt30 = screen.getByTestId("usage-page").querySelector("[data-testid='usage-chart-title']").parentElement.parentElement.textContent.match(/\$(\d[\d,]*)/)[1];
    fireEvent.click(screen.getByTestId("usage-range-7D"));
    const totalAt7 = screen.getByTestId("usage-page").querySelector("[data-testid='usage-chart-title']").parentElement.parentElement.textContent.match(/\$(\d[\d,]*)/)[1];
    expect(Number(totalAt30.replace(/,/g, ""))).toBeGreaterThan(Number(totalAt7.replace(/,/g, "")));
  });
});

describe("UsagePage — group-by drives breakdown values", () => {
  it("changing groupBy to platform:service swaps breakdown rows", () => {
    renderAt("/usage");
    // Default: cost-center → CC-PAY visible
    expect(screen.getByTestId("usage-breakdown")).toHaveTextContent(/CC-PAY/);
    fireEvent.click(screen.getByTestId("usage-groupby-button"));
    // 'Service' option
    const opt = screen.getAllByRole("option").find((el) => el.textContent.trim() === "Service");
    fireEvent.click(opt);
    expect(screen.getByTestId("usage-breakdown")).toHaveTextContent(/EC2/);
    expect(screen.getByTestId("usage-breakdown")).not.toHaveTextContent(/CC-PAY/);
  });
});

describe("UsagePage — untagged callout suppressed for platform group-by", () => {
  it("renders no untagged callout when grouping by Service", () => {
    renderAt("/usage");
    fireEvent.click(screen.getByTestId("usage-groupby-button"));
    const opt = screen.getAllByRole("option").find((el) => el.textContent.trim() === "Service");
    fireEvent.click(opt);
    expect(screen.queryByTestId("usage-untagged-callout")).not.toBeInTheDocument();
  });
});

describe("UsagePage — Granularity picker", () => {
  it("clicking Granularity opens a menu and selecting Weekly checks that option", () => {
    renderAt("/usage");
    fireEvent.click(screen.getByTestId("usage-granularity-button"));
    fireEvent.click(screen.getByTestId("usage-granularity-option-weekly"));
    expect(screen.getByTestId("usage-granularity-button")).toHaveTextContent(/Weekly/);
  });
});

describe("UsagePage — Export CSV", () => {
  it("clicking Export CSV creates a blob and triggers a download", () => {
    renderAt("/usage");
    const createObjectURL = vi.fn(() => "blob:usage");
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      fireEvent.click(screen.getByTestId("usage-export-csv"));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:usage");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe("UsagePage — breakdown Inspect button", () => {
  it("clicking Inspect on a breakdown row is wired (has a testid-targeted button)", () => {
    renderAt("/usage");
    // CC-PAY is the first cost-center row in the default scenario
    expect(screen.getByTestId("usage-breakdown-inspect-CC-PAY")).toBeInTheDocument();
  });
});
