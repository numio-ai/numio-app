import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TagGovernancePage from "./TagGovernancePage";
import { listSchemaConflicts } from "../../api/tagGovernance";

vi.mock("../../api/tagGovernance", () => ({
  listSchemaConflicts: vi.fn(() => Promise.resolve({ conflicts: [] })),
  previewTagApply: vi.fn(),
  applyTags: vi.fn(),
}));

class FakeIntersectionObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
global.IntersectionObserver = FakeIntersectionObserver;

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tag-governance" element={<TagGovernancePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagGovernancePage — defaults (A1, A5)", () => {
  it("renders Resources tab by default", () => {
    renderAt("/tag-governance");
    expect(screen.getByTestId("tg-tab-resources")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("tg-tab-schema")).toHaveAttribute("aria-selected", "false");
  });

  it("default view is 'Resources missing required tags'", () => {
    renderAt("/tag-governance");
    expect(screen.getByTestId("tg-views-button")).toHaveTextContent(/Resources missing required tags/);
  });
});

describe("TagGovernancePage — two tabs only (A2)", () => {
  it("only Resources and Tag schema tabs are present", () => {
    renderAt("/tag-governance");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent("Resources");
    expect(tabs[1]).toHaveTextContent("Tag schema");
  });

  it("Activity → link target points to /govern/audit", () => {
    renderAt("/tag-governance");
    const link = screen.getByTestId("tg-activity-link");
    expect(link).toHaveAttribute("href", "/govern/audit");
  });
});

describe("TagGovernancePage — no in-page Ask Numio (A4)", () => {
  it("does not render an 'Ask Numio' control", () => {
    renderAt("/tag-governance");
    expect(screen.queryByText(/^Ask Numio$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ask Numio to fix/i)).not.toBeInTheDocument();
  });
});

describe("TagGovernancePage — Resources cell chips (A3)", () => {
  it("renders the four-color cell system on rendered rows", () => {
    renderAt("/tag-governance?status=all");
    expect(screen.getByTestId("tg-row-i-0a4f8c2d")).toBeInTheDocument();
    const row1 = screen.getByTestId("tg-row-i-0a4f8c2d");
    const okCell = within(row1).getByTestId("tg-cell-env");
    expect(okCell).toHaveAttribute("data-cell-kind", "ok");

    const driftRow = screen.getByTestId("tg-row-i-09ce772");
    expect(within(driftRow).getByTestId("tg-cell-env")).toHaveAttribute("data-cell-kind", "drift");

    const eipRow = screen.getByTestId("tg-row-eip-0c1f");
    expect(within(eipRow).getByTestId("tg-cell-env")).toHaveAttribute("data-cell-kind", "missing-req");
  });
});

describe("TagGovernancePage — bulk select (A6)", () => {
  it("checking a row reveals the bulk action bar with the four listed actions", () => {
    renderAt("/tag-governance?status=all");
    expect(screen.queryByTestId("tg-bulk-action-bar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tg-checkbox-i-0a4f8c2d"));
    const bar = screen.getByTestId("tg-bulk-action-bar");
    expect(bar).toHaveTextContent(/1 selected/);
    expect(within(bar).getByTestId("tg-bulk-apply-tag")).toBeInTheDocument();
    expect(within(bar).getByTestId("tg-bulk-suggest")).toBeInTheDocument();
    expect(within(bar).getByTestId("tg-bulk-rename")).toBeInTheDocument();
    expect(within(bar).getByTestId("tg-bulk-export")).toBeInTheDocument();
  });

  it("Clear restores selection to zero", () => {
    renderAt("/tag-governance?status=all");
    fireEvent.click(screen.getByTestId("tg-checkbox-i-0a4f8c2d"));
    fireEvent.click(screen.getByTestId("tg-checkbox-i-0fc7b21e"));
    expect(screen.getByTestId("tg-bulk-action-bar")).toHaveTextContent(/2 selected/);
    fireEvent.click(screen.getByTestId("tg-bulk-clear"));
    expect(screen.queryByTestId("tg-bulk-action-bar")).not.toBeInTheDocument();
  });
});

describe("TagGovernancePage — Schema tab (A7)", () => {
  it("renders the list editor with the required columns and + New tag key", () => {
    renderAt("/tag-governance?tab=schema");
    expect(screen.getByTestId("tg-schema-table")).toBeInTheDocument();
    expect(screen.getByText("KEY")).toBeInTheDocument();
    expect(screen.getByText("REQUIRED")).toBeInTheDocument();
    expect(screen.getByText("ALLOWED VALUES")).toBeInTheDocument();
    expect(screen.getByText("COVERAGE")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
    expect(screen.getByTestId("tg-new-tag-key")).toBeInTheDocument();
  });

  it("coverage chip color tones match thresholds", () => {
    renderAt("/tag-governance?tab=schema");
    expect(screen.getByTestId("tg-coverage-env")).toHaveAttribute("data-coverage-tone", "ok");          // 91%
    expect(screen.getByTestId("tg-coverage-cost-center")).toHaveAttribute("data-coverage-tone", "warn"); // 73%
    expect(screen.getByTestId("tg-coverage-criticality")).toHaveAttribute("data-coverage-tone", "danger"); // 22%
  });
});

describe("TagGovernancePage — view URL restoration (A5)", () => {
  it("?view=drift restores the view selection", () => {
    renderAt("/tag-governance?view=drift");
    expect(screen.getByTestId("tg-views-button")).toHaveTextContent(/Drift/);
  });
});

describe("TagGovernancePage — status segmented (A2)", () => {
  it("clicking Missing required scopes the table", () => {
    renderAt("/tag-governance?status=all");
    fireEvent.click(screen.getByTestId("tg-status-missing-req"));
    expect(screen.getByTestId("tg-status-missing-req")).toHaveAttribute("aria-selected", "true");
  });
});

describe("TagGovernancePage — Apply tag wiring (task 5)", () => {
  it("clicking Apply tag… on a selection opens the ApplyTagModal", () => {
    renderAt("/tag-governance?status=all");
    fireEvent.click(screen.getByTestId("tg-checkbox-i-0a4f8c2d"));
    fireEvent.click(screen.getByTestId("tg-bulk-apply-tag"));
    expect(screen.getByTestId("apply-tag-modal")).toBeInTheDocument();
    expect(screen.getByTestId("atm-count")).toHaveTextContent("1");
  });
});

describe("TagGovernancePage — AWS Org schema conflicts (task 6)", () => {
  it("renders a conflicts count badge and inline conflicts on the Schema tab", async () => {
    listSchemaConflicts.mockResolvedValueOnce({
      conflicts: [
        {
          tag_key: "env",
          conflict_type: "required_mismatch",
          detail: "Numio enforces 'env' as required; AWS Org does not.",
        },
      ],
    });
    renderAt("/tag-governance?tab=schema");

    const badge = await screen.findByTestId("tg-schema-conflicts-badge");
    expect(badge).toHaveTextContent("1");
    expect(screen.getByTestId("tg-schema-conflicts")).toBeInTheDocument();
    expect(screen.getByTestId("tg-conflict-env-required_mismatch")).toHaveTextContent(
      /AWS Org does not/
    );
  });

  it("shows no conflicts badge when the endpoint returns none", async () => {
    listSchemaConflicts.mockResolvedValueOnce({ conflicts: [] });
    renderAt("/tag-governance?tab=schema");
    // schema table renders synchronously; the badge must never appear
    expect(await screen.findByTestId("tg-schema-table")).toBeInTheDocument();
    expect(screen.queryByTestId("tg-schema-conflicts-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tg-schema-conflicts")).not.toBeInTheDocument();
  });
});

describe("TagGovernancePage — row ⋯ menu (resources tab)", () => {
  it("clicking ⋯ on a row shows a 'coming soon' toast (no silent failure)", () => {
    renderAt("/tag-governance");
    const buttons = document.querySelectorAll('[data-testid^="tg-row-menu-"]');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId("tg-toast")).toHaveTextContent(/coming soon/);
  });
});

describe("TagGovernancePage — schema ⋯ button", () => {
  it("clicking ⋯ on a schema row shows a 'coming soon' toast", async () => {
    listSchemaConflicts.mockResolvedValueOnce({ conflicts: [] });
    renderAt("/tag-governance?tab=schema");
    const button = await screen.findByTestId("tg-schema-menu-env");
    fireEvent.click(button);
    expect(screen.getByTestId("tg-toast")).toHaveTextContent(/Edit env — coming soon/);
  });
});
