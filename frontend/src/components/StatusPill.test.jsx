import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusPill from "./StatusPill";

const stateConfig = {
  active: { label: "Active", dotColor: "#16a34a", background: "#f0fdf4", textColor: "#16a34a" },
  paused: { label: "Paused", dotColor: "#d97706", background: "#fffbeb", textColor: "#d97706" },
  disabled: { label: "Disabled", dotColor: "#dc2626", background: "#fef2f2", textColor: "#dc2626" },
};

function FakeIcon() {
  return <svg data-testid="fake-icon" />;
}

describe("StatusPill", () => {
  beforeEach(() => {
    // Reset window width to a desktop default for each test
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    window.dispatchEvent(new Event("resize"));
  });

  it("renders subsystem + state label on desktop", () => {
    render(<StatusPill subsystem="Autopilot" state="active" stateConfig={stateConfig} />);
    expect(screen.getByText("Autopilot: Active")).toBeInTheDocument();
  });

  it("renders the configured dot color for the current state", () => {
    const { container } = render(
      <StatusPill subsystem="Autopilot" state="paused" stateConfig={stateConfig} />
    );
    const dot = container.querySelector("span[aria-hidden]");
    expect(dot.style.background).toBe("rgb(217, 119, 6)");
  });

  it("renders leading icon when provided", () => {
    render(
      <StatusPill
        subsystem="Autopilot"
        state="active"
        stateConfig={stateConfig}
        icon={FakeIcon}
      />
    );
    expect(screen.getByTestId("fake-icon")).toBeInTheDocument();
  });

  it("renders as a button when onClick provided; fires on click", () => {
    const onClick = vi.fn();
    render(
      <StatusPill
        subsystem="Autopilot"
        state="active"
        stateConfig={stateConfig}
        onClick={onClick}
      />
    );
    const pill = screen.getByRole("button");
    fireEvent.click(pill);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders as a status span when no onClick", () => {
    render(<StatusPill subsystem="Autopilot" state="active" stateConfig={stateConfig} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses provided ariaLabel over the default", () => {
    render(
      <StatusPill
        subsystem="Autopilot"
        state="active"
        stateConfig={stateConfig}
        ariaLabel="Autopilot status: Active. Open Autopilot menu"
        onClick={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Autopilot status: Active. Open Autopilot menu" })
    ).toBeInTheDocument();
  });

  it("falls back to a neutral visual when state not in config", () => {
    const { container } = render(
      <StatusPill subsystem="Autopilot" state="mystery" stateConfig={stateConfig} />
    );
    const dot = container.querySelector("span[aria-hidden]");
    expect(dot.style.background).toBe("rgb(156, 163, 175)");
  });

  it("collapses to icon-only on narrow viewport; state stays in title/aria-label", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 480 });
    window.dispatchEvent(new Event("resize"));
    render(
      <StatusPill
        subsystem="Autopilot"
        state="paused"
        stateConfig={stateConfig}
        icon={FakeIcon}
      />
    );
    // Visible text no longer present
    expect(screen.queryByText("Autopilot: Paused")).not.toBeInTheDocument();
    // Icon + title + aria-label still carry the state
    expect(screen.getByTestId("fake-icon")).toBeInTheDocument();
    const pill = screen.getByRole("status");
    expect(pill).toHaveAttribute("title", "Autopilot: Paused");
    expect(pill).toHaveAttribute("aria-label", "Autopilot status: Paused");
  });

  it("propagates aria-haspopup / aria-expanded for disclosure patterns", () => {
    render(
      <StatusPill
        subsystem="Autopilot"
        state="active"
        stateConfig={stateConfig}
        onClick={() => {}}
        ariaHasPopup="menu"
        ariaExpanded={true}
      />
    );
    const pill = screen.getByRole("button");
    expect(pill).toHaveAttribute("aria-haspopup", "menu");
    expect(pill).toHaveAttribute("aria-expanded", "true");
  });
});
