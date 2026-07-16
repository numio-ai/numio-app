import { describe, it, expect } from "vitest";
import { formatCurrency, formatCurrencyWithCents, formatPercent } from "./format";

describe("formatCurrency", () => {
  it("formats whole dollar amounts", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
    expect(formatCurrency(0)).toBe("$0");
    expect(formatCurrency(999999)).toBe("$999,999");
  });

  it("handles NaN and non-numeric input", () => {
    expect(formatCurrency(NaN)).toBe("$0");
    expect(formatCurrency("abc")).toBe("$0");
    expect(formatCurrency(undefined)).toBe("$0");
  });

  it("handles string numbers", () => {
    expect(formatCurrency("5000")).toBe("$5,000");
  });

  it("compact mode shortens to K", () => {
    expect(formatCurrency(1500, true)).toBe("$1.5K");
    expect(formatCurrency(2000, true)).toBe("$2K");
    expect(formatCurrency(45200, true)).toBe("$45.2K");
  });

  it("compact mode leaves small values unchanged", () => {
    expect(formatCurrency(500, true)).toBe("$500");
    expect(formatCurrency(999, true)).toBe("$999");
  });
});

describe("formatCurrencyWithCents", () => {
  it("shows cents for small values", () => {
    expect(formatCurrencyWithCents(12.5)).toBe("$12.50");
    expect(formatCurrencyWithCents(0.99)).toBe("$0.99");
  });

  it("omits cents for large values", () => {
    expect(formatCurrencyWithCents(500)).toBe("$500");
    expect(formatCurrencyWithCents(1234.56)).toBe("$1,234.56");
  });

  it("handles NaN", () => {
    expect(formatCurrencyWithCents(NaN)).toBe("$0.00");
  });
});

describe("formatPercent", () => {
  it("rounds and appends %", () => {
    expect(formatPercent(75.4)).toBe("75%");
    expect(formatPercent(99.9)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });
});
