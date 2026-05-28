import { describe, it, expect, vi, afterEach } from "vitest";
import { request, gracefulRequest, ApiError } from "./client";
import { getNotifications, getInfraPolicies, getTotalCost } from "./dashboard";
import { getCfnTemplate } from "./onboarding";
import { inviteUser } from "./workspace";

// In Vitest, VITE_API_MODE is undefined, so request() runs the real (fetch)
// path. We mock global.fetch to exercise the consolidated client behavior.
// (The mock-dispatch path is covered by registry.test.js.)

function mockFetch(impl) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request() — real mode", () => {
  it("returns parsed JSON on success", async () => {
    mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ hello: "world" }) }));
    await expect(request("/api/v1/thing")).resolves.toEqual({ hello: "world" });
  });

  it("returns null on HTTP 204", async () => {
    mockFetch(async () => ({ ok: true, status: 204, json: async () => null }));
    await expect(request("/api/v1/thing", { method: "DELETE" })).resolves.toBeNull();
  });

  it("sends credentials and the default Content-Type, merging caller headers", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await request("/api/v1/thing", { headers: { "X-Custom": "1" } });
    const [, init] = spy.mock.calls[0];
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ "Content-Type": "application/json", "X-Custom": "1" });
  });

  it("throws ApiError carrying status/detail/errorCode/body on non-2xx", async () => {
    mockFetch(async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ detail: "bad sql", error_code: "INVALID_SQL" }),
    }));
    await expect(request("/api/v1/thing")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      detail: "bad sql",
      errorCode: "INVALID_SQL",
      message: "bad sql",
    });
  });

  it("gracefulRequest resolves to null instead of throwing", async () => {
    mockFetch(async () => ({ ok: false, status: 500, statusText: "Server Error", json: async () => null }));
    await expect(gracefulRequest("/api/v1/thing")).resolves.toBeNull();
  });
});

describe("request() — params option", () => {
  function urlOf(spy) {
    return spy.mock.calls[0][0];
  }

  it("coerces numbers, keeps false, drops null/undefined", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await request("/x", { params: { a: 1, b: false, c: null, d: undefined, e: "" } });
    expect(urlOf(spy)).toBe("/x?a=1&b=false&e=");
  });

  it("appends no query when params is omitted", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await request("/x");
    expect(urlOf(spy)).toBe("/x");
  });

  it("getNotifications omits unread_only when false", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await getNotifications({ unread_only: false });
    expect(urlOf(spy)).toBe("/api/v1/notifications?limit=100&offset=0");
  });

  it("getNotifications sends unread_only=true when true", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await getNotifications({ unread_only: true });
    expect(urlOf(spy)).toBe("/api/v1/notifications?limit=100&offset=0&unread_only=true");
  });

  it("getInfraPolicies sends is_active=false but omits it when undefined", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await getInfraPolicies({ is_active: false });
    expect(urlOf(spy)).toBe("/api/v1/infra-policies?is_active=false&limit=100&offset=0");
    spy.mockClear();
    await getInfraPolicies({});
    expect(urlOf(spy)).toBe("/api/v1/infra-policies?limit=100&offset=0");
  });

  it("getTotalCost drops the optional account when not given", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await getTotalCost("2026-01-01", "2026-01-31");
    expect(urlOf(spy)).toBe(
      "/api/v1/cost-views/total?start_date=2026-01-01&end_date=2026-01-31&granularity=daily",
    );
  });

  it("getCfnTemplate keeps deliberate empty-string params", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await getCfnTemplate({ label: "demo" });
    expect(urlOf(spy)).toBe(
      "/api/v1/onboarding/cfn-template?label=demo&region=us-east-1&cur_mode=existing" +
        "&cur_bucket_name=&cur_report_name=&cur_path_prefix=cur&enable_tag_writes=false",
    );
  });

  it("gracefulRequest forwards params", async () => {
    const spy = vi.fn(async () => ({ ok: false, status: 500, statusText: "x", json: async () => null }));
    mockFetch(spy);
    await expect(gracefulRequest("/x", { params: { a: 1 } })).resolves.toBeNull();
    expect(urlOf(spy)).toBe("/x?a=1");
  });
});

describe("request() — json option", () => {
  it("stringifies the body and sets Content-Type", async () => {
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    mockFetch(spy);
    await inviteUser("a@b.co", "Ann", "admin");
    const [, init] = spy.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ email: "a@b.co", name: "Ann", role: "admin" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});

describe("ApiError", () => {
  it("is an Error subclass with the documented fields", () => {
    const e = new ApiError("boom", { status: 404, detail: "nope", errorCode: "X", body: { a: 1 } });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ApiError");
    expect(e.status).toBe(404);
    expect(e.detail).toBe("nope");
    expect(e.errorCode).toBe("X");
    expect(e.body).toEqual({ a: 1 });
  });
});
