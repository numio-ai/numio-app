/**
 * Synthetic mock data substrate — public entry point.
 *
 * Domain datasets import the canonical entities, seeded generator, and
 * consistency harness from here:
 *
 *   import { ACCOUNTS, makeRng, allocate, reconciles } from "../mocks/synthetic";
 */
export * from "./entities";
export * from "./seed";
export * from "./consistency";
