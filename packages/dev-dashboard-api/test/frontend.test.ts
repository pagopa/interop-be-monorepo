import { afterEach, describe, expect, it, vi } from "vitest";

import { frontendServiceBuilder } from "../src/services/frontendService.js";

afterEach(() => vi.unstubAllGlobals());

describe("optional frontend observation", () => {
  it("reads validated frontend status and log tails without mutation requests", async () => {
    const status = {
      available: true,
      running: true,
      mode: "local",
      state: "passed",
      phases: [],
    };
    const probe = vi
      .fn()
      .mockResolvedValueOnce(Response.json(status))
      .mockResolvedValueOnce(Response.json({ content: "INFO Vite ready" }));
    vi.stubGlobal("fetch", probe);
    const frontend = frontendServiceBuilder("http://frontend:8077");

    expect(await frontend.status()).toEqual(status);
    expect(await frontend.logs("vite")).toEqual({ content: "INFO Vite ready" });
    expect(probe.mock.calls.map(([url]) => url)).toEqual([
      "http://frontend:8077/status",
      "http://frontend:8077/logs?source=vite",
    ]);
    for (const [, options] of probe.mock.calls) {
      expect(options).toMatchObject({
        redirect: "error",
        signal: expect.any(AbortSignal),
      });
      expect(options.method).toBeUndefined();
    }
  });

  it.each([
    () => Promise.reject(new Error("connection refused")),
    () => Promise.resolve(Response.json({ running: true })),
    () =>
      Promise.resolve(
        Response.json({ error: "not available" }, { status: 503 })
      ),
  ])(
    "reports an unavailable observer without hiding backend status",
    async (response) => {
      vi.stubGlobal("fetch", vi.fn(response));
      expect(
        await frontendServiceBuilder("http://frontend:8077").status()
      ).toEqual({
        available: false,
        running: false,
        state: "pending",
        phases: [],
        error: "Cannot reach the frontend runtime",
      });
    }
  );

  it("rejects an oversized frontend log response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ content: "x".repeat(65537) }))
    );
    await expect(
      frontendServiceBuilder("http://frontend:8077").logs("startup")
    ).rejects.toThrow();
  });
});
