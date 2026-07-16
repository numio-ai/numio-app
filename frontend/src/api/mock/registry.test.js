import { describe, it, expect, beforeEach } from "vitest";
import { dispatchMock } from "./registry";
import { store } from "./store";
import { setMockLatency } from "./latency";
import { ApiError } from "../client";

// Freeze latency to zero so the suite is fast and deterministic (spec §6).
beforeEach(() => {
  setMockLatency(0, 0);
  store.reset();
});

describe("dispatchMock (inbox vertical slice)", () => {
  it("resolves a GET read from the registry", async () => {
    const badge = await dispatchMock("/api/v1/inbox/badge");
    expect(badge).toMatchObject({ unread_count: 7, triage_count: 3, critical_count: 1 });
  });

  it("routes a write through the store and reflects it in a later read", async () => {
    const res = await dispatchMock("/api/v1/inbox/findings/f-1/ack", {
      method: "POST",
    });
    expect(res).toEqual({ finding_id: "f-1", acknowledged: true, new_unread_count: 6 });

    const after = await dispatchMock("/api/v1/inbox/badge");
    expect(after.unread_count).toBe(6);
  });

  it("throws ApiError(404) when no handler matches", async () => {
    await expect(dispatchMock("/api/v1/does-not-exist")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
    await expect(dispatchMock("/api/v1/does-not-exist")).rejects.toBeInstanceOf(ApiError);
  });

  it("ignores the query string when matching", async () => {
    const badge = await dispatchMock("/api/v1/inbox/badge?foo=bar");
    expect(badge.unread_count).toBe(7);
  });
});
