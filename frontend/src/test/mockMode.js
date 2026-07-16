/**
 * Reusable Vitest helper to run a test through the mock seam (VITE_API_MODE=mock).
 *
 * Opt-in per test: call `enableMockMode()` in the test (or a beforeEach), then
 * `disableMockMode()` after. Because src/api/client.js reads
 * `import.meta.env.VITE_API_MODE` at call time, `vi.stubEnv` flips the seam to
 * mock without a global `vitest.config` define — so the rest of the suite
 * (including the real-mode client.test.js) is unaffected.
 *
 * Pattern (minimal boilerplate):
 *
 *   import { enableMockMode, disableMockMode } from "../../test/mockMode";
 *   let net;
 *   beforeEach(() => { net = enableMockMode(); });
 *   afterEach(disableMockMode);
 *   // ...render a component; assert on mock-served data; expect(net).not.toHaveBeenCalled();
 */
import { vi } from "vitest";
import { store } from "../api/mock/store";
import { setMockLatency } from "../api/mock/latency";

/**
 * Activate mock mode for the current test. Zeroes latency for determinism,
 * resets the in-memory store to its seed, and replaces global.fetch with a spy
 * that throws — so any real network attempt fails the test.
 * @returns {import("vitest").Mock} the fetch spy (assert it was never called).
 */
export function enableMockMode() {
  vi.stubEnv("VITE_API_MODE", "mock");
  setMockLatency(0, 0);
  store.reset();
  const fetchSpy = vi.fn(() => {
    throw new Error("real network call issued while in mock mode");
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

/** Restore real mode and undo the global/env stubs. */
export function disableMockMode() {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
}
