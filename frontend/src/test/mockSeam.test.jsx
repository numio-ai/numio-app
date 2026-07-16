import React, { useEffect, useState } from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { enableMockMode, disableMockMode } from "./mockMode";
import { getFindings } from "../api/dashboard";
import { getTotalCost } from "../api/dashboard";

// A minimal component that fetches through the real API module. In mock mode
// the call resolves via the shared request() seam → mock registry, with no
// network. This is the reusable mock-backed pattern (distinct from the existing
// direct-import tests, which assert on values imported into the test).
function FindingsCount() {
  const [n, setN] = useState(null);
  useEffect(() => {
    getFindings().then((d) => setN(d.count));
  }, []);
  return <div>{n === null ? "loading…" : `${n} findings`}</div>;
}

describe("mock seam — component renders mock-served data with no network", () => {
  let net;
  beforeEach(() => {
    net = enableMockMode();
  });
  afterEach(disableMockMode);

  it("renders findings count served via the mock seam", async () => {
    render(<FindingsCount />);
    expect(screen.getByText("loading…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/\d+ findings/)).toBeInTheDocument());
    expect(net).not.toHaveBeenCalled();
  });

  it("API functions resolve from the mock layer (cost total) with no fetch", async () => {
    const total = await getTotalCost("2026-01-01", "2026-05-31");
    expect(typeof total.total).toBe("string");
    expect(total.currency).toBe("USD");
    expect(net).not.toHaveBeenCalled();
  });
});
