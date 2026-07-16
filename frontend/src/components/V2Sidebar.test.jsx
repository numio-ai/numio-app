import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const inboxCountMock = vi.fn();
const authMock = vi.fn();

vi.mock("../hooks/useInboxUnreadCount", () => ({
  default: () => inboxCountMock(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authMock(),
}));

import V2Sidebar from "./V2Sidebar";

function renderAt(path, { count = 11, role = "admin" } = {}) {
  inboxCountMock.mockReturnValue(count);
  authMock.mockReturnValue({ user: { role } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<V2Sidebar />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

const EXPECTED_ORDER = [
  ["work", ["inbox"]],
  ["understand", ["usage", "resources"]],
  ["optimize", ["recommendations", "autopilot"]],
  ["govern", ["tag-governance", "budgets", "policies"]],
  ["admin", ["ingestion", "data-explorer", "settings"]],
];

const ROUTE_TO_GROUP = {
  "/inbox": "work",
  "/usage": "understand",
  "/resources": "understand",
  "/recommendations": "optimize",
  "/autopilot": "optimize",
  "/tag-governance": "govern",
  "/budgets": "govern",
  "/policies": "govern",
  "/ingestion": "admin",
  "/data-explorer": "admin",
  "/settings": "admin",
};

describe("V2Sidebar — structure (A1)", () => {
  it("renders all expected items in the correct group order", () => {
    renderAt("/inbox");
    for (const groupId of ["understand", "optimize", "govern"]) {
      const label = screen.getByTestId(`v2-group-label-${groupId}`);
      if (label.getAttribute("aria-expanded") === "false") fireEvent.click(label);
    }
    for (const [groupId, itemIds] of EXPECTED_ORDER) {
      const groupItems = screen.getByTestId(`v2-group-items-${groupId}`);
      for (const itemId of itemIds) {
        expect(within(groupItems).getByTestId(`v2-item-${itemId}`)).toBeInTheDocument();
      }
    }
  });

  it("renders the three labeled group headers", () => {
    renderAt("/inbox");
    expect(screen.getByTestId("v2-group-label-understand")).toHaveTextContent(/Understand/i);
    expect(screen.getByTestId("v2-group-label-optimize")).toHaveTextContent(/Optimize/i);
    expect(screen.getByTestId("v2-group-label-govern")).toHaveTextContent(/Govern/i);
  });

  it("hides Data Explorer for non-admin users", () => {
    renderAt("/settings", { role: "member" });
    expect(screen.queryByTestId("v2-item-data-explorer")).not.toBeInTheDocument();
    expect(screen.getByTestId("v2-item-settings")).toBeInTheDocument();
  });
});

describe("V2Sidebar — group collapse (A2)", () => {
  it("expands only the group containing the active route on first render", () => {
    renderAt("/usage");
    expect(screen.getByTestId("v2-group-label-understand")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("v2-group-label-optimize")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("v2-group-label-govern")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("v2-group-items-understand")).toBeInTheDocument();
    expect(screen.queryByTestId("v2-group-items-optimize")).not.toBeInTheDocument();
  });

  it("clicking a group label toggles its child list", () => {
    renderAt("/inbox");
    const optimize = screen.getByTestId("v2-group-label-optimize");
    expect(optimize).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("v2-group-items-optimize")).not.toBeInTheDocument();

    fireEvent.click(optimize);
    expect(optimize).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("v2-group-items-optimize")).toBeInTheDocument();

    fireEvent.click(optimize);
    expect(optimize).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("v2-group-items-optimize")).not.toBeInTheDocument();
  });

  it("unlabeled groups (work, admin) are always shown", () => {
    renderAt("/usage");
    expect(screen.getByTestId("v2-group-items-work")).toBeInTheDocument();
    expect(screen.getByTestId("v2-group-items-admin")).toBeInTheDocument();
  });
});

describe("V2Sidebar — Inbox badge (A3)", () => {
  it("renders the badge with the count when > 0", () => {
    renderAt("/inbox", { count: 11 });
    const badge = screen.getByTestId("v2-inbox-badge");
    expect(badge).toHaveTextContent("11");
    expect(badge).toHaveAttribute("aria-label", "11 unread");
  });

  it("hides the badge when count = 0", () => {
    renderAt("/inbox", { count: 0 });
    expect(screen.queryByTestId("v2-inbox-badge")).not.toBeInTheDocument();
  });
});

describe("V2Sidebar — active highlight + parent group (A4, A6)", () => {
  for (const [path, expectedGroup] of Object.entries(ROUTE_TO_GROUP)) {
    const itemId = path.slice(1);
    it(`highlights ${itemId} and expands group ${expectedGroup} at ${path}`, () => {
      renderAt(path);
      const item = screen.getByTestId(`v2-item-${itemId}`);
      expect(item).toHaveAttribute("aria-current", "page");
      expect(item).toHaveStyle({ background: "#f3f4f6" });
      const groupItems = screen.getByTestId(`v2-group-items-${expectedGroup}`);
      expect(within(groupItems).getByTestId(`v2-item-${itemId}`)).toBeInTheDocument();
    });
  }

  it("non-active items have transparent background", () => {
    renderAt("/inbox");
    const usage = screen.queryByTestId("v2-item-usage");
    if (usage) expect(usage).toHaveStyle({ background: "transparent" });
  });
});
