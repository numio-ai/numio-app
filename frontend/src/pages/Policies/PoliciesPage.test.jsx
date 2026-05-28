import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PoliciesPage from "./PoliciesPage";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/policies" element={<PoliciesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PoliciesPage — basics (A1, A5)", () => {
  it("renders the page", () => {
    renderAt("/policies");
    expect(screen.getByTestId("policies-page")).toBeInTheDocument();
  });

  it("default view is All policies; all 5 view presets present", () => {
    renderAt("/policies");
    expect(screen.getByTestId("policies-views-button")).toHaveTextContent(/All policies/);
    fireEvent.click(screen.getByTestId("policies-views-button"));
    expect(screen.getByTestId("policies-view-row-all")).toBeInTheDocument();
    expect(screen.getByTestId("policies-view-row-violations")).toBeInTheDocument();
    expect(screen.getByTestId("policies-view-row-block")).toBeInTheDocument();
    expect(screen.getByTestId("policies-view-row-disabled")).toBeInTheDocument();
    expect(screen.getByTestId("policies-view-row-mine")).toBeInTheDocument();
  });
});

describe("PoliciesPage — enabled toggle (A2)", () => {
  it("clicking the toggle flips state without confirmation", () => {
    renderAt("/policies");
    const toggle = screen.getByTestId("policy-toggle-p-1");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});

describe("PoliciesPage — bulk select (A3)", () => {
  it("selecting two rows surfaces the action bar with Enable / Disable / Change mode / Export / Clear", () => {
    renderAt("/policies");
    expect(screen.queryByTestId("policies-bulk-action-bar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("policy-checkbox-p-1"));
    fireEvent.click(screen.getByTestId("policy-checkbox-p-2"));
    const bar = screen.getByTestId("policies-bulk-action-bar");
    expect(bar).toHaveTextContent(/2 selected/);
    expect(within(bar).getByTestId("policies-bulk-enable")).toBeInTheDocument();
    expect(within(bar).getByTestId("policies-bulk-disable")).toBeInTheDocument();
    expect(within(bar).getByTestId("policies-bulk-change-mode")).toBeInTheDocument();
    expect(within(bar).getByTestId("policies-bulk-export")).toBeInTheDocument();
    expect(within(bar).getByTestId("policies-bulk-clear")).toBeInTheDocument();
  });

  it("bulk Disable flips the enabled state of selected rows then clears selection", () => {
    renderAt("/policies");
    fireEvent.click(screen.getByTestId("policy-checkbox-p-1"));
    fireEvent.click(screen.getByTestId("policy-checkbox-p-2"));
    fireEvent.click(screen.getByTestId("policies-bulk-disable"));
    expect(screen.getByTestId("policy-toggle-p-1")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("policy-toggle-p-2")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("policies-bulk-action-bar")).not.toBeInTheDocument();
  });

  it("Clear restores selection to zero", () => {
    renderAt("/policies");
    fireEvent.click(screen.getByTestId("policy-checkbox-p-1"));
    fireEvent.click(screen.getByTestId("policies-bulk-clear"));
    expect(screen.queryByTestId("policies-bulk-action-bar")).not.toBeInTheDocument();
  });
});

describe("PoliciesPage — mode chips (A4)", () => {
  it("Block, Warn, Auto-remediate chips all render with correct data attribute", () => {
    renderAt("/policies");
    expect(screen.getByTestId("policy-mode-chip-p-1")).toHaveAttribute("data-mode", "block");
    expect(screen.getByTestId("policy-mode-chip-p-1")).toHaveTextContent("Block");
    expect(screen.getByTestId("policy-mode-chip-p-3")).toHaveAttribute("data-mode", "warn");
    expect(screen.getByTestId("policy-mode-chip-p-3")).toHaveTextContent("Warn");
    expect(screen.getByTestId("policy-mode-chip-p-5")).toHaveAttribute("data-mode", "auto");
    expect(screen.getByTestId("policy-mode-chip-p-5")).toHaveTextContent("Auto-remediate");
  });
});

describe("PoliciesPage — no row Edit button (A6)", () => {
  it("no Edit button is rendered in policy rows", () => {
    renderAt("/policies");
    const row = screen.getByTestId("policy-row-p-1");
    expect(within(row).queryByRole("button", { name: /^Edit$/i })).not.toBeInTheDocument();
  });

  it("row ⋯ menu exists in lieu of Edit", () => {
    renderAt("/policies");
    expect(screen.getByTestId("policy-row-menu-p-1")).toBeInTheDocument();
  });
});

describe("PoliciesPage — view filtering", () => {
  it("Blocking policies view shows only mode=block rows", () => {
    renderAt("/policies");
    fireEvent.click(screen.getByTestId("policies-views-button"));
    fireEvent.click(screen.getByTestId("policies-view-row-block"));
    expect(screen.getByTestId("policy-row-p-1")).toBeInTheDocument(); // block
    expect(screen.queryByTestId("policy-row-p-3")).not.toBeInTheDocument(); // warn
    expect(screen.queryByTestId("policy-row-p-5")).not.toBeInTheDocument(); // auto
  });

  it("Disabled view shows only enabled=false rows", () => {
    renderAt("/policies");
    fireEvent.click(screen.getByTestId("policies-views-button"));
    fireEvent.click(screen.getByTestId("policies-view-row-disabled"));
    expect(screen.getByTestId("policy-row-p-7")).toBeInTheDocument();
    expect(screen.queryByTestId("policy-row-p-1")).not.toBeInTheDocument();
  });
});

describe("PoliciesPage — subtitle signals", () => {
  it("subtitle aggregates active / blocking / auto / open violations", () => {
    renderAt("/policies");
    const subtitle = screen.getByTestId("policies-subtitle");
    expect(subtitle).toHaveTextContent(/active policies/);
    expect(subtitle).toHaveTextContent(/blocking/);
    expect(subtitle).toHaveTextContent(/auto-remediate/);
    expect(subtitle).toHaveTextContent(/open violations/);
  });
});

describe("PoliciesPage — row menu actions", () => {
  it("Open editor shows a 'coming soon' toast (no silent failure)", async () => {
    const { container } = renderAt("/policies");
    // Open the first row's ⋯ menu — the test file already gave it a testid pattern of policy-row-menu-<id>.
    const menuButtons = container.querySelectorAll('[data-testid^="policy-row-menu-"]');
    const firstButton = [...menuButtons].find((b) => b.tagName === "BUTTON");
    fireEvent.click(firstButton);
    const openEditor = await screen.findByText("Open editor");
    fireEvent.click(openEditor);
    expect(screen.getByTestId("policies-toast")).toHaveTextContent(/coming soon/);
  });
});
