import { describe, it, expect, vi, afterEach } from "vitest";
import { request, gracefulRequest, ApiError } from "./client";

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
