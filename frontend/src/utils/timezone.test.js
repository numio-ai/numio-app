import { describe, it, expect, beforeEach } from "vitest";
import { getSavedTimeZone, saveTimeZonePreference, resolveTimeZone, getTimeOfDay } from "./timezone";

describe("getSavedTimeZone", () => {
  beforeEach(() => localStorage.clear());

  it("returns default when nothing saved", () => {
    expect(getSavedTimeZone()).toEqual({ mode: "auto", zone: "" });
  });

  it("returns saved preference", () => {
    localStorage.setItem("numio.profile.timezone", JSON.stringify({ mode: "manual", zone: "US/Eastern" }));
    expect(getSavedTimeZone()).toEqual({ mode: "manual", zone: "US/Eastern" });
  });

  it("returns default on corrupted JSON", () => {
    localStorage.setItem("numio.profile.timezone", "not-json");
    expect(getSavedTimeZone()).toEqual({ mode: "auto", zone: "" });
  });
});

describe("saveTimeZonePreference", () => {
  beforeEach(() => localStorage.clear());

  it("persists to localStorage", () => {
    saveTimeZonePreference("manual", "Europe/London");
    const stored = JSON.parse(localStorage.getItem("numio.profile.timezone"));
    expect(stored).toEqual({ mode: "manual", zone: "Europe/London" });
  });
});

describe("resolveTimeZone", () => {
  it("returns manual zone when mode is manual", () => {
    expect(resolveTimeZone("manual", "US/Pacific")).toBe("US/Pacific");
  });

  it("returns system timezone for auto mode", () => {
    const tz = resolveTimeZone("auto", "");
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

describe("getTimeOfDay", () => {
  it("returns a valid time-of-day string", () => {
    const result = getTimeOfDay("UTC");
    expect(["morning", "afternoon", "evening"]).toContain(result);
  });

  it("handles invalid timezone gracefully", () => {
    expect(getTimeOfDay("Invalid/Zone")).toBe("morning");
  });
});
