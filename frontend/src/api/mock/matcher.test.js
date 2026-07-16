import { describe, it, expect } from "vitest";
import { matchPath, matchRoute } from "./matcher";

describe("matchPath", () => {
  it("matches an exact static path with no params", () => {
    expect(matchPath("/api/v1/inbox/badge", "/api/v1/inbox/badge")).toEqual({});
  });

  it("captures a dynamic :segment", () => {
    expect(matchPath("/api/v1/findings/:id/ack", "/api/v1/findings/abc-123/ack")).toEqual({
      id: "abc-123",
    });
  });

  it("decodes encoded param segments", () => {
    expect(matchPath("/api/v1/jobs/:type/trigger", "/api/v1/jobs/cur%20ingestion/trigger")).toEqual({
      type: "cur ingestion",
    });
  });

  it("returns null on segment-count mismatch", () => {
    expect(matchPath("/api/v1/inbox/badge", "/api/v1/inbox")).toBeNull();
  });

  it("returns null when a static segment differs", () => {
    expect(matchPath("/api/v1/budgets", "/api/v1/policies")).toBeNull();
  });
});

describe("matchRoute", () => {
  const routes = [
    { method: "GET", path: "/api/v1/inbox/badge", handler: () => "badge" },
    { method: "POST", path: "/api/v1/inbox/findings/:id/ack", handler: () => "ack" },
  ];

  it("matches on method + path and attaches params", () => {
    const m = matchRoute(routes, "POST", "/api/v1/inbox/findings/42/ack");
    expect(m.params).toEqual({ id: "42" });
    expect(m.handler()).toBe("ack");
  });

  it("does not match when the method differs", () => {
    expect(matchRoute(routes, "POST", "/api/v1/inbox/badge")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(matchRoute(routes, "GET", "/api/v1/unknown")).toBeNull();
  });
});
