import { afterEach, describe, expect, it, vi } from "vitest";

import { frontendServiceBuilder } from "../src/services/frontendService.js";
import { supervisorServiceBuilder } from "../src/services/supervisorService.js";

afterEach(() => vi.unstubAllGlobals());

const frontend = () =>
  frontendServiceBuilder(
    "http://frontend:8077",
    supervisorServiceBuilder({
      beRoot: "/be",
      packages: [],
      presets: [],
      driver: {
        run: async () => "",
        start: async () => ({ pid: 1, stop: async () => undefined }),
      },
    }),
    {
      identities: async () => ({ ready: false, tenants: [] }),
      identity: async () => ({ sessionToken: "unused" }),
    }
  );

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
    const service = frontend();

    expect(await service.status()).toEqual(status);
    expect(await service.logs("vite")).toEqual({ content: "INFO Vite ready" });
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
      expect(await frontend().status()).toEqual({
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
    await expect(frontend().logs("startup")).rejects.toThrow();
  });
});
