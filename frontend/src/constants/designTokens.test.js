import { describe, it, expect } from "vitest";
import { formatCurrency, formatCurrentMonth } from "./designTokens";

describe("designTokens formatCurrency", () => {
  it("formats small values with cents", () => {
    expect(formatCurrency(12.5, true)).toBe("12.50");
    expect(formatCurrency(99.99, true)).toBe("99.99");
  });

  it("formats large values without cents", () => {
    expect(formatCurrency(5000)).toBe("5,000");
    expect(formatCurrency(123456)).toBe("123,456");
  });

  it("shows cents for values under 100 without flag", () => {
    expect(formatCurrency(50)).toBe("50.00");
  });
});

describe("formatCurrentMonth", () => {
  it("returns month and year string", () => {
    const result = formatCurrentMonth();
    expect(result).toMatch(/^\w+ \d{4}$/);
  });
});
