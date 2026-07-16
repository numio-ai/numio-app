/**
 * Cross-screen consistency + determinism harness (spec §5.3, §5.4).
 *
 * Reusable, dependency-free assertion helpers. The core task proves them on
 * sample data; the cost / governance / platform datasets call the same helpers
 * in their own tests to assert their data reconciles and references only
 * canonical entities.
 */

/** Sum an array of numbers. */
export function sum(values) {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0);
}

/** Sum one numeric field across an array of objects. */
export function sumField(items, field) {
  return sum(items.map((i) => i[field]));
}

/** True when `parts` sum to `total` within `epsilon` (default: exact to a cent). */
export function reconciles(total, parts, epsilon = 0.01) {
  return Math.abs((Number(total) || 0) - sum(parts)) <= epsilon;
}

/** True when one numeric field across `items` sums to `total` within epsilon. */
export function reconcilesField(total, items, field, epsilon = 0.01) {
  return reconciles(total, items.map((i) => i[field]), epsilon);
}

/**
 * True when every value in `values` is structurally identical — used to assert
 * the same canonical entity (account, service, region) resolves to the same
 * value on every screen that references it.
 */
export function resolvesIdentically(values) {
  if (values.length <= 1) return true;
  const first = JSON.stringify(values[0]);
  return values.every((v) => JSON.stringify(v) === first);
}

/**
 * True when calling `generatorFn` twice yields byte-identical output. The
 * generator must be seeded and free of any live clock or Math.random.
 */
export function isDeterministic(generatorFn) {
  return JSON.stringify(generatorFn()) === JSON.stringify(generatorFn());
}
