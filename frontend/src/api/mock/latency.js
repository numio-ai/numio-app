/**
 * Shared artificial-latency wrapper for mock responses (spec §6).
 *
 * Every mock response resolves through `withLatency` so loading spinners and
 * skeletons render during a demo. The delay is configurable in one place;
 * tests freeze it to zero via `setMockLatency(0, 0)` for speed and determinism.
 */

let range = { min: 150, max: 400 };

/** Override the latency range. Tests use `setMockLatency(0, 0)`. */
export function setMockLatency(min, max = min) {
  range = { min, max };
}

/** Resolve `value` after the configured artificial delay. */
export function withLatency(value) {
  const { min, max } = range;
  const delay = max <= min ? min : min + Math.floor(Math.random() * (max - min));
  if (delay <= 0) return Promise.resolve(value);
  return new Promise((resolve) => setTimeout(() => resolve(value), delay));
}
