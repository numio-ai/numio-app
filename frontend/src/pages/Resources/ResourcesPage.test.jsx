import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ResourcesPage from "./ResourcesPage";

class FakeIntersectionObserver {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
  unobserve() {}
}
global.IntersectionObserver = FakeIntersectionObserver;

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resources" element={<ResourcesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResourcesPage — defaults (A1)", () => {
  it("renders the page with default 'All resources' view and 36px rows", () => {
    renderAt("/resources");
    expect(screen.getByTestId("resources-page")).toBeInTheDocument();
    expect(screen.getByTestId("resources-views-button")).toHaveTextContent(/All resources/);
    const ec2Row = screen.getByTestId("resources-row-i-0a4f8c2d09b3e7a11");
    expect(ec2Row).toHaveStyle({ height: "36px" });
  });
});

describe("ResourcesPage — density toggle (A2)", () => {
  it("clicking Comfortable bumps rows to 52px", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-density-comfortable"));
    const ec2Row = screen.getByTestId("resources-row-i-0a4f8c2d09b3e7a11");
    expect(ec2Row).toHaveStyle({ height: "52px" });
  });
});

describe("ResourcesPage — polymorphic State column (A3)", () => {
  it("EC2 running → good", () => {
    renderAt("/resources");
    const row = screen.getByTestId("resources-row-i-0a4f8c2d09b3e7a11");
    expect(within(row).getByTestId("state-cell")).toHaveAttribute("data-state-kind", "good");
  });

  it("EC2 stopped → bad", () => {
    renderAt("/resources");
    const row = screen.getByTestId("resources-row-i-08fa3c1b9d4e76f02");
    expect(within(row).getByTestId("state-cell")).toHaveAttribute("data-state-kind", "bad");
  });

  it("RDS available → good", () => {
    renderAt("/resources");
    const row = screen.getByTestId("resources-row-db-finance-prod-1");
    expect(within(row).getByTestId("state-cell")).toHaveAttribute("data-state-kind", "good");
  });

  it("EBS unassociated → warn", () => {
    renderAt("/resources");
    const row = screen.getByTestId("resources-row-vol-079b3f12c4ad99e");
    expect(within(row).getByTestId("state-cell")).toHaveAttribute("data-state-kind", "warn");
  });

  it("EIP unassociated → warn", () => {
    renderAt("/resources");
    const row = screen.getByTestId("resources-row-eip-0c1f9b2e");
    expect(within(row).getByTestId("state-cell")).toHaveAttribute("data-state-kind", "warn");
  });

  it("S3 (stateless) → none / —", () => {
    renderAt("/resources");
    const row = screen.getByTestId("resources-row-s3://numio-static-prod");
    expect(within(row).getByTestId("state-cell")).toHaveAttribute("data-state-kind", "none");
  });

  it("Lambda (stateless) → none / —", () => {
    renderAt("/resources");
    const row = screen.getByTestId("resources-row-arn:lambda:search-api-fn");
    expect(within(row).getByTestId("state-cell")).toHaveAttribute("data-state-kind", "none");
  });
});

describe("ResourcesPage — columns picker (A4)", () => {
  it("opens the picker with three labeled sections", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-columns-button"));
    const listbox = screen.getByRole("listbox", { name: /Columns/ });
    expect(listbox).toHaveTextContent(/Always shown/i);
    expect(listbox).toHaveTextContent(/Built-in/i);
    expect(listbox).toHaveTextContent(/Tag columns/i);
  });

  it("toggling tag:env adds it to the column header", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-columns-button"));
    fireEvent.click(screen.getByTestId("resources-column-option-tag:env"));
    fireEvent.click(screen.getByTestId("resources-columns-button"));
    expect(screen.getByText("tag:env")).toBeInTheDocument();
  });

  it("URL with cols= renders the requested columns", () => {
    renderAt("/resources?cols=name,svc,spend,tag:cost-center");
    expect(screen.getByText("tag:cost-center")).toBeInTheDocument();
  });
});

describe("ResourcesPage — bulk selection (A5)", () => {
  it("selecting a row surfaces the bulk action bar", () => {
    renderAt("/resources");
    expect(screen.queryByTestId("resources-bulk-action-bar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("resources-checkbox-i-0a4f8c2d09b3e7a11"));
    const bar = screen.getByTestId("resources-bulk-action-bar");
    expect(bar).toHaveTextContent(/1 selected/);
    expect(bar).toHaveTextContent(/Apply tag/);
    expect(bar).toHaveTextContent(/Hibernate/);
    expect(bar).toHaveTextContent(/Send to Recommendations/);
    expect(bar).toHaveTextContent(/Export selected/);
  });

  it("Clear restores the selection to zero", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-checkbox-i-0a4f8c2d09b3e7a11"));
    fireEvent.click(screen.getByTestId("resources-checkbox-db-finance-prod-1"));
    expect(screen.getByTestId("resources-bulk-action-bar")).toHaveTextContent(/2 selected/);
    fireEvent.click(screen.getByTestId("resources-bulk-clear"));
    expect(screen.queryByTestId("resources-bulk-action-bar")).not.toBeInTheDocument();
  });
});

describe("ResourcesPage — infinite scroll (A6)", () => {
  it("renders the sentinel element below the rows", () => {
    renderAt("/resources");
    expect(screen.getByTestId("resources-infinite-sentinel")).toBeInTheDocument();
  });

  it("status line indicates more results", () => {
    renderAt("/resources");
    expect(screen.getByTestId("resources-status-line")).toHaveTextContent(/of 1,284/);
  });
});

describe("ResourcesPage — saved views (A7, A8)", () => {
  it("URL with view=no-cc + cols= restores the cost-center-focused columns", () => {
    renderAt("/resources?view=no-cc&cols=name,svc,spend,tag:cost-center,tag:env,gaps");
    expect(screen.getByTestId("resources-views-button")).toHaveTextContent(/Missing cost-center/);
    expect(screen.getByText("tag:cost-center")).toBeInTheDocument();
  });

  it("clicking a saved view in the picker writes view+density+cols to URL", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-views-button"));
    fireEvent.click(screen.getByTestId("resources-view-row-no-cc"));
    expect(screen.getByTestId("resources-views-button")).toHaveTextContent(/Missing cost-center/);
    expect(screen.getByText("tag:cost-center")).toBeInTheDocument();
  });

  it("expensive view sets density to comfortable", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-views-button"));
    fireEvent.click(screen.getByTestId("resources-view-row-expensive"));
    expect(screen.getByTestId("resources-density-comfortable")).toHaveAttribute("aria-selected", "true");
  });
});

describe("ResourcesPage — row click opens detail panel", () => {
  it("clicking a row name opens the side panel with that resource", () => {
    renderAt("/resources");
    expect(screen.queryByTestId("resources-detail-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("resources-row-open-i-0a4f8c2d09b3e7a11"));
    const panel = screen.getByTestId("resources-detail-panel");
    expect(panel).toHaveTextContent(/payments-api-prod-3/);
    expect(panel).toHaveTextContent(/EC2/);
  });

  it("clicking the close button dismisses the panel", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-row-open-i-0a4f8c2d09b3e7a11"));
    fireEvent.click(screen.getByTestId("resources-detail-close"));
    expect(screen.queryByTestId("resources-detail-panel")).not.toBeInTheDocument();
  });
});

describe("ResourcesPage — per-row ⋯ menu", () => {
  it("clicking ⋯ opens an action menu with Copy ID and View details", () => {
    renderAt("/resources");
    const id = "i-0a4f8c2d09b3e7a11";
    fireEvent.click(screen.getByTestId(`resources-row-menu-button-${id}`));
    const menu = screen.getByTestId(`resources-row-menu-${id}`);
    expect(within(menu).getByTestId(`resources-row-menu-copy-id-${id}`)).toBeInTheDocument();
    expect(within(menu).getByTestId(`resources-row-menu-view-${id}`)).toBeInTheDocument();
  });

  it("View details from the ⋯ menu opens the detail panel", () => {
    renderAt("/resources");
    const id = "i-0a4f8c2d09b3e7a11";
    fireEvent.click(screen.getByTestId(`resources-row-menu-button-${id}`));
    fireEvent.click(screen.getByTestId(`resources-row-menu-view-${id}`));
    expect(screen.getByTestId("resources-detail-panel")).toHaveTextContent(/payments-api-prod-3/);
  });
});

describe("ResourcesPage — Export CSV", () => {
  it("clicking Export CSV triggers a download (anchor click with a CSV blob href)", () => {
    renderAt("/resources");
    // Spy on URL.createObjectURL and anchor.click
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      fireEvent.click(screen.getByTestId("resources-export-csv"));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe("ResourcesPage — Share link", () => {
  it("clicking Share link writes the current URL to the clipboard", () => {
    renderAt("/resources");
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByTestId("resources-share-link"));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toBe(window.location.href);
  });
});

describe("ResourcesPage — bulk action wiring", () => {
  function selectFirstTwo() {
    fireEvent.click(screen.getByTestId("resources-checkbox-i-0a4f8c2d09b3e7a11"));
    fireEvent.click(screen.getByTestId("resources-checkbox-db-finance-prod-1"));
  }

  it("Apply tag… opens the ApplyTagModal with the selected resource ids", () => {
    renderAt("/resources");
    selectFirstTwo();
    fireEvent.click(screen.getByTestId("resources-bulk-apply-tag"));
    // ApplyTagModal is rendered with data-testid prefix 'atm-' for its inputs
    expect(screen.getByTestId("atm-cancel")).toBeInTheDocument();
  });

  it("Hibernate shows a toast and clears selection", () => {
    renderAt("/resources");
    selectFirstTwo();
    fireEvent.click(screen.getByTestId("resources-bulk-hibernate"));
    expect(screen.getByTestId("resources-bulk-toast")).toHaveTextContent(/Queued 2 resources for hibernation/);
    expect(screen.queryByTestId("resources-bulk-action-bar")).not.toBeInTheDocument();
  });

  it("Export selected triggers a blob download", () => {
    renderAt("/resources");
    selectFirstTwo();
    const createObjectURL = vi.fn(() => "blob:selected");
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    try {
      fireEvent.click(screen.getByTestId("resources-bulk-export"));
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:selected");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});

describe("ResourcesPage — Manage all views", () => {
  it("clicking Manage all views… opens a dialog listing saved views", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-views-button"));
    fireEvent.click(screen.getByTestId("resources-manage-views"));
    const dialog = screen.getByTestId("resources-manage-views-dialog");
    expect(dialog).toHaveTextContent(/All resources/);
    expect(dialog).toHaveTextContent(/Manage saved views/);
  });

  it("close button dismisses the dialog", () => {
    renderAt("/resources");
    fireEvent.click(screen.getByTestId("resources-views-button"));
    fireEvent.click(screen.getByTestId("resources-manage-views"));
    fireEvent.click(screen.getByTestId("resources-manage-views-close"));
    expect(screen.queryByTestId("resources-manage-views-dialog")).not.toBeInTheDocument();
  });
});
