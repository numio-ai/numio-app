import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingMethodHub from "./OnboardingMethodHub";

describe("OnboardingMethodHub", () => {
  it("renders Guided as the primary option", () => {
    render(
      <OnboardingMethodHub chatEnabled={false} onSelect={() => {}} onCancel={() => {}} />,
    );
    const guided = screen.getByTestId("onboarding-method-guided");
    expect(guided).toBeInTheDocument();
    expect(guided).toHaveTextContent(/Guided setup/i);
    expect(guided).toHaveTextContent(/Recommended/i);
  });

  it("renders Advanced as a secondary link, not a sibling card", () => {
    render(<OnboardingMethodHub chatEnabled={false} onSelect={() => {}} />);
    const advanced = screen.getByTestId("onboarding-method-advanced");
    // Advanced must be a button inside the secondary-link footer block,
    // not a big card like Guided. Check that it is not the primary option.
    expect(advanced).toBeInTheDocument();
    expect(advanced.tagName).toBe("BUTTON");
    // Its computed style signals de-emphasis via an underlined text link.
    expect(advanced.style.textDecoration).toBe("underline");
  });

  it("hides the Chat option when the flag is off", () => {
    render(<OnboardingMethodHub chatEnabled={false} onSelect={() => {}} />);
    expect(screen.queryByTestId("onboarding-method-chat")).toBeNull();
  });

  it("shows the Chat option when the flag is on", () => {
    render(<OnboardingMethodHub chatEnabled={true} onSelect={() => {}} />);
    expect(screen.getByTestId("onboarding-method-chat")).toBeInTheDocument();
  });

  it("emits onSelect('guided') when Guided is clicked", () => {
    const onSelect = vi.fn();
    render(<OnboardingMethodHub chatEnabled onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("onboarding-method-guided"));
    expect(onSelect).toHaveBeenCalledWith("guided");
  });

  it("emits onSelect('advanced') when the Advanced link is clicked", () => {
    const onSelect = vi.fn();
    render(<OnboardingMethodHub chatEnabled={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("onboarding-method-advanced"));
    expect(onSelect).toHaveBeenCalledWith("advanced");
  });

  it("emits onSelect('chat') when the Chat card is clicked", () => {
    const onSelect = vi.fn();
    render(<OnboardingMethodHub chatEnabled onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("onboarding-method-chat"));
    expect(onSelect).toHaveBeenCalledWith("chat");
  });

  it("omits the Cancel button when onCancel is not provided", () => {
    render(<OnboardingMethodHub chatEnabled={false} onSelect={() => {}} />);
    expect(screen.queryByTestId("onboarding-hub-cancel")).toBeNull();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <OnboardingMethodHub chatEnabled={false} onSelect={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByTestId("onboarding-hub-cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});
