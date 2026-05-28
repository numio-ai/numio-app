import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AutopilotPage from "./AutopilotPage";
import { setAutopilotPausedAll } from "../../hooks/useAutopilotStatus";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "tester@numio.local" } }),
}));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/autopilot" element={<AutopilotPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  setAutopilotPausedAll(false);
});

describe("AutopilotPage — defaults (A2)", () => {
  it("renders the Rules tab as default with all listed columns visible", () => {
    renderAt("/autopilot");
    expect(screen.getByTestId("autopilot-tab-rules")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Rule")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("Runs 7d")).toBeInTheDocument();
    expect(screen.getByText("Saved 7d")).toBeInTheDocument();
    expect(screen.getByText("Last run")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
  });
});

describe("AutopilotPage — toggle switch (A3)", () => {
  it("clicking the toggle flips the rule's state immediately", () => {
    renderAt("/autopilot");
    const toggle = screen.getByTestId("rule-toggle-rule-hibernate-dev");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});

describe("AutopilotPage — archive (A4)", () => {
  it("archiving hides the rule from the default view; archived count shows it", () => {
    renderAt("/autopilot");
    fireEvent.click(screen.getByTestId("rule-row-menu-rule-resize-rds"));
    fireEvent.click(screen.getByTestId("rule-menu-archive-rule-resize-rds"));
    expect(screen.queryByTestId("rule-row-rule-resize-rds")).not.toBeInTheDocument();
    expect(screen.getByTestId("rules-filter-archived")).toHaveTextContent(/Archived \(2\)/);
  });
});

describe("AutopilotPage — delete (A5)", () => {
  it("delete is hidden in non-archived rule's menu", () => {
    renderAt("/autopilot");
    fireEvent.click(screen.getByTestId("rule-row-menu-rule-hibernate-dev"));
    expect(screen.queryByTestId("rule-menu-delete-rule-hibernate-dev")).not.toBeInTheDocument();
  });

  it("delete opens type-name-to-confirm dialog from archived rule", () => {
    renderAt("/autopilot");
    fireEvent.click(screen.getByTestId("rules-filter-archived"));
    fireEvent.click(screen.getByTestId("rule-row-menu-rule-old-snapshot"));
    fireEvent.click(screen.getByTestId("rule-menu-delete-rule-old-snapshot"));
    const dialog = screen.getByTestId("delete-rule-dialog");
    expect(dialog).toBeInTheDocument();
    const confirm = screen.getByTestId("delete-rule-confirm");
    expect(confirm).toBeDisabled();
    const input = screen.getByTestId("delete-rule-input");
    fireEvent.change(input, { target: { value: "wrong name" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(input, { target: { value: "Clean ancient snapshots" } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(screen.queryByTestId("delete-rule-dialog")).not.toBeInTheDocument();
  });
});

describe("AutopilotPage — Undo cell semantics (A6)", () => {
  it("within-window action shows '↶ Undo · ... left'", () => {
    renderAt("/autopilot?tab=history");
    const undo = screen.getByTestId("history-undo-ah-2026-05-16-001");
    expect(undo).toHaveAttribute("data-kind", "within");
    expect(undo).toHaveTextContent(/↶ Undo/);
    expect(undo).toHaveTextContent(/left/);
  });

  it("auto-resumed action shows 'auto-resumed'", () => {
    renderAt("/autopilot?tab=history");
    const undo = screen.getByTestId("history-undo-ah-2026-05-16-004");
    expect(undo).toHaveAttribute("data-kind", "auto");
    expect(undo).toHaveTextContent(/auto-resumed/);
  });

  it("advisory action shows 'advisory only'", () => {
    renderAt("/autopilot?tab=history");
    const undo = screen.getByTestId("history-undo-ah-2026-05-16-005");
    expect(undo).toHaveAttribute("data-kind", "advisory");
    expect(undo).toHaveTextContent(/advisory only/);
  });

  it("past-window action shows 'undo expired'", () => {
    renderAt("/autopilot?tab=history");
    const undo = screen.getByTestId("history-undo-ah-2026-05-16-006");
    expect(undo).toHaveAttribute("data-kind", "expired");
    expect(undo).toHaveTextContent(/undo expired/);
  });
});

describe("AutopilotPage — Pause all (A7)", () => {
  it("requires confirmation and flips the status pill to paused", () => {
    renderAt("/autopilot");
    expect(screen.getByTestId("autopilot-status-pill")).toHaveAttribute("data-state", "active");
    fireEvent.click(screen.getByTestId("autopilot-pause-all"));
    expect(screen.getByTestId("pause-all-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pause-all-confirm"));
    expect(screen.queryByTestId("pause-all-dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("autopilot-status-pill")).toHaveAttribute("data-state", "paused");
    expect(screen.getByTestId("autopilot-paused-banner")).toBeInTheDocument();
  });

  it("Resume all clears the paused state", () => {
    renderAt("/autopilot");
    fireEvent.click(screen.getByTestId("autopilot-pause-all"));
    fireEvent.click(screen.getByTestId("pause-all-confirm"));
    fireEvent.click(screen.getByTestId("autopilot-resume-all"));
    expect(screen.getByTestId("autopilot-status-pill")).toHaveAttribute("data-state", "active");
    expect(screen.queryByTestId("autopilot-paused-banner")).not.toBeInTheDocument();
  });
});

describe("AutopilotPage — + New rule routes through Send-to-Autopilot (A8)", () => {
  it("opens the 3-tab modal, then transitions to the SendToAutopilotModal on Configure", () => {
    renderAt("/autopilot");
    fireEvent.click(screen.getByTestId("autopilot-new-rule"));
    const modal = screen.getByTestId("new-rule-modal");
    expect(within(modal).getByTestId("nrm-tab-from-recommendation")).toBeInTheDocument();
    expect(within(modal).getByTestId("nrm-tab-from-template")).toBeInTheDocument();
    expect(within(modal).getByTestId("nrm-tab-from-scratch")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("nrm-configure"));
    expect(screen.queryByTestId("new-rule-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("send-to-autopilot-modal")).toBeInTheDocument();
  });
});

describe("AutopilotPage — Outcome chip color mapping (A9)", () => {
  it("stopped/resized → indigo", () => {
    renderAt("/autopilot?tab=history");
    const chip = screen.getByTestId("history-outcome-ah-2026-05-16-001");
    expect(chip).toHaveAttribute("data-outcome", "stopped");
    expect(chip).toHaveStyle({ color: "#3730a3" });
  });

  it("blocked/deleted → orange", () => {
    renderAt("/autopilot?tab=history");
    const blocked = screen.getByTestId("history-outcome-ah-2026-05-16-002");
    expect(blocked).toHaveStyle({ color: "#9a3412" });
    const deleted = screen.getByTestId("history-outcome-ah-2026-05-16-003");
    expect(deleted).toHaveStyle({ color: "#9a3412" });
  });

  it("resumed → green", () => {
    renderAt("/autopilot?tab=history");
    const chip = screen.getByTestId("history-outcome-ah-2026-05-16-004");
    expect(chip).toHaveStyle({ color: "#166534" });
  });
});

describe("AutopilotPage — bulk actions", () => {
  it("selecting two rows surfaces the bulk bar with Pause/Resume/Archive/Export/Clear", () => {
    renderAt("/autopilot");
    fireEvent.click(screen.getByTestId("rule-checkbox-rule-hibernate-dev"));
    fireEvent.click(screen.getByTestId("rule-checkbox-rule-pr-cost-guard"));
    const bar = screen.getByTestId("rules-bulk-action-bar");
    expect(bar).toHaveTextContent(/2 selected/);
    expect(within(bar).getByTestId("rules-bulk-pause")).toBeInTheDocument();
    expect(within(bar).getByTestId("rules-bulk-resume")).toBeInTheDocument();
    expect(within(bar).getByTestId("rules-bulk-archive")).toBeInTheDocument();
    expect(within(bar).getByTestId("rules-bulk-clear")).toBeInTheDocument();
  });

  it("Clear bulk selection hides the action bar", () => {
    renderAt("/autopilot");
    fireEvent.click(screen.getByTestId("rule-checkbox-rule-hibernate-dev"));
    fireEvent.click(screen.getByTestId("rules-bulk-clear"));
    expect(screen.queryByTestId("rules-bulk-action-bar")).not.toBeInTheDocument();
  });
});

describe("AutopilotPage — Edit / Duplicate / View runs", () => {
  function openMenu(ruleId) {
    fireEvent.click(screen.getByTestId(`rule-row-menu-${ruleId}`));
  }

  it("Edit opens the edit dialog prefilled with the rule's name", () => {
    renderAt("/autopilot");
    openMenu("rule-hibernate-dev");
    fireEvent.click(screen.getByTestId("rule-menu-edit-rule-hibernate-dev"));
    expect(screen.getByTestId("autopilot-edit-rule-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("autopilot-edit-rule-name")).toHaveValue("Hibernate dev/sandbox nightly");
  });

  it("Saving the edit updates the rule's name in the table", () => {
    renderAt("/autopilot");
    openMenu("rule-hibernate-dev");
    fireEvent.click(screen.getByTestId("rule-menu-edit-rule-hibernate-dev"));
    fireEvent.change(screen.getByTestId("autopilot-edit-rule-name"), { target: { value: "Hibernate dev nightly v2" } });
    fireEvent.click(screen.getByTestId("autopilot-edit-rule-save"));
    expect(screen.queryByTestId("autopilot-edit-rule-dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/Hibernate dev nightly v2/)).toBeInTheDocument();
  });

  it("Duplicate appends a new row with '(copy)' suffix", () => {
    renderAt("/autopilot");
    openMenu("rule-hibernate-dev");
    fireEvent.click(screen.getByTestId("rule-menu-duplicate-rule-hibernate-dev"));
    expect(screen.getByText(/Hibernate dev\/sandbox nightly \(copy\)/)).toBeInTheDocument();
  });

  it("View runs switches to History tab and applies the rule filter", () => {
    renderAt("/autopilot");
    openMenu("rule-hibernate-dev");
    fireEvent.click(screen.getByTestId("rule-menu-view-runs-rule-hibernate-dev"));
    expect(screen.getByTestId("autopilot-tab-history")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("history-rule-filter-clear")).toHaveTextContent(/Hibernate dev\/sandbox nightly/);
  });
});

describe("AutopilotPage — History Export CSV", () => {
  it("clicking Export CSV creates a blob and triggers download", () => {
    renderAt("/autopilot?tab=history");
    const createObjectURL = vi.fn(() => "blob:autopilot");
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      fireEvent.click(screen.getByTestId("history-export-csv"));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:autopilot");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
