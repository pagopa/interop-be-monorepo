import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { request } from "../../api/client";
import axiosInstance from "../../config/axios";

describe("dashboard transport", () => {
  it("uses the shared Axios client and validates its response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ready: true }))
    );
    const client = vi.spyOn(axiosInstance, "request");
    await expect(
      request("/status", z.object({ ready: z.boolean() }))
    ).resolves.toEqual({ ready: true });
    expect(client).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/status" })
    );
  });
  it("accepts a successful empty response without attempting to parse JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 204 }))
    );
    await expect(
      request("/presets/personal", z.void(), { method: "DELETE" })
    ).resolves.toBeUndefined();
  });
  it("accepts JSON scalar values and rejects malformed JSON even when the schema accepts strings", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json("message"))
        .mockResolvedValueOnce(new Response("not json", { status: 200 }))
    );
    await expect(request("/status", z.string())).resolves.toBe("message");
    await expect(request("/status", z.string())).rejects.toThrow(
      "invalid API response"
    );
  });
  it.each([
    { body: { error: "Action conflict" }, message: "Action conflict" },
    {
      body: { error: { detail: "Internal state" } },
      message: "Request failed (409).",
    },
  ])(
    "normalizes an HTTP failure to the validated message '$message'",
    async ({ body, message }) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json(body, { status: 409 }))
      );
      await expect(request("/actions", z.object({}))).rejects.toThrow(message);
    }
  );
  it("preserves Axios network errors for callers without treating them as invalid API responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"))
    );
    await expect(request("/status", z.object({}))).rejects.toMatchObject({
      code: "ERR_NETWORK",
      message: "Network Error",
    });
  });
  it("rejects cancellation without dispatching an already aborted request", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(
      request("/status", z.object({}), { signal: controller.signal })
    ).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("cancels an in-flight request through its composed network signal", async () => {
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
    const pending = request("/status", z.object({}), {
      signal: controller.signal,
    });
    const rejected = expect(pending).rejects.toMatchObject({
      code: "ERR_CANCELED",
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    controller.abort();
    await rejected;
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
  it("reports a safe HTTP error when the failure response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("Bad gateway", { status: 502 }))
    );
    await expect(request("/status", z.object({}), undefined)).rejects.toThrow(
      "Request failed (502)."
    );
  });
  it("rejects an invalid successful response at the transport boundary", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ unexpected: true }))
    );
    await expect(
      request("/status", z.object({ frontendAvailable: z.boolean() }).strict())
    ).rejects.toThrow("invalid API response");
  });
  it("reports the same invalid-response error when a successful response contains malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("not json", { status: 200 }))
    );
    await expect(
      request("/status", z.object({ frontendAvailable: z.boolean() }))
    ).rejects.toThrow("invalid API response");
  });
});
