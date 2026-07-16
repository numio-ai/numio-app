/**
 * Seeded, deterministic generator primitives for the synthetic mock data layer.
 *
 * Two runs with the same seed produce byte-identical output: there is no live
 * clock, no Math.random, and no run-dependent ordering anywhere in this layer.
 * Domain datasets (cost, governance, platform) build on these primitives and
 * the canonical entities in ./entities.js.
 */

/** Fixed seed shared by every domain dataset so the full set is reproducible. */
export const CORE_SEED = 0x6e756d69; // "numi"

/**
 * mulberry32 — a tiny, fast, well-distributed seeded PRNG.
 * @returns {() => number} a function yielding floats in [0, 1).
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] inclusive. */
export function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Float in [min, max). */
export function rngFloat(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element from a non-empty array. */
export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Currency rounded to cents. */
export function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Split `total` across `weights`, returning amounts that sum **exactly** to
 * `total` (to the cent). The last element absorbs the rounding remainder, so
 * downstream reconciliation checks hold with epsilon 0. This is the primitive
 * the cost/governance datasets use to keep by-dimension breakdowns consistent
 * with their period totals.
 *
 * @param {number} total
 * @param {number[]} weights non-negative relative weights
 * @returns {number[]} per-weight amounts whose sum === round2(total)
 */
export function allocate(total, weights) {
  const wSum = weights.reduce((a, w) => a + (w > 0 ? w : 0), 0) || weights.length;
  const cents = weights.map((w) => Math.round(((w > 0 ? w : 0) / wSum) * total * 100));
  const diff = Math.round(total * 100) - cents.reduce((a, c) => a + c, 0);
  if (cents.length) cents[cents.length - 1] += diff;
  return cents.map((c) => c / 100);
}
