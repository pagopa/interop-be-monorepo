import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardService } from "../../src/api/dashboard/dashboard.services";
import axiosInstance from "../../src/config/axios";
import { identitiesFixture } from "../fixtures";

describe("dashboard services", () => {
  it("passes validated seed preparation as Axios data through the shared client", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ operationId: "prepare" }, { status: 202 })
        )
    );
    const client = vi.spyOn(axiosInstance, "request");
    await expect(
      DashboardService.runAction({ type: "seed.prepare" })
    ).resolves.toEqual({ operationId: "prepare" });
    expect(client).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/actions",
        method: "POST",
        data: { type: "seed.prepare" },
      })
    );
  });
  it("serializes log filters, incremental cursors and cancellation in one transport", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Request aborted", "AbortError")),
            { once: true }
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const rejected = expect(
      DashboardService.getLogs(
        {
          source: "group:seed",
          service: "tenant",
          level: "error",
          search: "build failed",
          cid: "seed-cid",
          cursors: { tenant: "1" },
          limit: 500,
        },
        controller.signal
      )
    ).rejects.toMatchObject({ code: "ERR_CANCELED" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const url = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
      "http://localhost"
    );
    expect(url.pathname).toBe("/__local-dashboard/api/logs");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      source: "group:seed",
      service: "tenant",
      level: "error",
      search: "build failed",
      cid: "seed-cid",
      cursors: '{"tenant":"1"}',
      limit: "500",
    });
    controller.abort();
    await rejected;
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
  it("gets validated identities and posts the existing identity payload without exposing other fields", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(identitiesFixture))
      .mockResolvedValueOnce(Response.json({ sessionToken: "session" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await DashboardService.getIdentities()).toEqual(identitiesFixture);
    expect(
      await DashboardService.generateToken({
        tenantKey: "consumer",
        userId: "admin",
      })
    ).toEqual({ sessionToken: "session" });
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).pathname).toBe(
      "/__local-dashboard/api/identity"
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: '{"tenantKey":"consumer","userId":"admin"}',
    });
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Content-Type")
    ).toBe("application/json");
  });
  it("accepts an encoded preset deletion with a 204 response", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await DashboardService.deletePreset("personal / preset");
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
      "/__local-dashboard/api/presets/personal%20%2F%20preset"
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE");
  });
  it("rejects extra seed preparation payload fields before sending a request", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    expect(() =>
      DashboardService.runAction({
        type: "seed.prepare",
        // @ts-expect-error Verify validation of an untrusted runtime payload.
        names: ["tenant"],
      })
    ).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
