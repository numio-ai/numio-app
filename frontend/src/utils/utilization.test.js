import { describe, it, expect } from "vitest";
import { getUtilClass, getUtilBarClass } from "./utilization";

describe("getUtilClass", () => {
  it("returns util-low for null/undefined", () => {
    expect(getUtilClass(null)).toBe("util-low");
    expect(getUtilClass(undefined)).toBe("util-low");
  });

  it("returns util-low for 0-30%", () => {
    expect(getUtilClass(0)).toBe("util-low");
    expect(getUtilClass(15)).toBe("util-low");
    expect(getUtilClass(30)).toBe("util-low");
  });

  it("returns util-moderate for 31-60%", () => {
    expect(getUtilClass(31)).toBe("util-moderate");
    expect(getUtilClass(50)).toBe("util-moderate");
    expect(getUtilClass(60)).toBe("util-moderate");
  });

  it("returns util-healthy for 61-80%", () => {
    expect(getUtilClass(61)).toBe("util-healthy");
    expect(getUtilClass(75)).toBe("util-healthy");
    expect(getUtilClass(80)).toBe("util-healthy");
  });

  it("returns util-high for 81-100%", () => {
    expect(getUtilClass(81)).toBe("util-high");
    expect(getUtilClass(100)).toBe("util-high");
  });
});

describe("getUtilBarClass", () => {
  it("converts util- prefix to util-bar-", () => {
    expect(getUtilBarClass(10)).toBe("util-bar-low");
    expect(getUtilBarClass(50)).toBe("util-bar-moderate");
    expect(getUtilBarClass(70)).toBe("util-bar-healthy");
    expect(getUtilBarClass(90)).toBe("util-bar-high");
  });
});
