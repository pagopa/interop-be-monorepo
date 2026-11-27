import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LogEntry } from "../../src/api/dashboard/dashboard.services";

import { useIncrementalLogs } from "../../src/hooks/useIncrementalLogs";

const filters = { source: "", level: "", search: "" };

function log(id: string, source = "agreement"): LogEntry {
  return { id, source, service: source, level: "info", message: `Log ${id}` };
}

describe("incremental aggregate logs", () => {
  it.each([
    { source: "group:packages" },
    { level: "error" },
    { search: "CID-42" },
  ])(
    "retains the displayed batch during a slow filter transition: %j",
    async (change) => {
      let finish: (response: Response) => void = () => undefined;
      const next = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            entries: [log("1")],
            cursors: { agreement: "old:1" },
            resetSources: [],
          })
        )
        .mockReturnValueOnce(next);
      vi.stubGlobal("fetch", fetchMock);
      const { result, rerender } = renderHook(
        (value) => useIncrementalLogs(value),
        {
          initialProps: filters,
        }
      );
      await waitFor(() => expect(result.current.entries[0]?.id).toBe("1"));
      rerender({ ...filters, ...change });
      expect(result.current.entries.map(({ id }) => id)).toEqual(["1"]);
      expect(result.current.loading).toBe(true);
      expect(result.current.isPreviousData).toBe(true);
      expect(
        new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.has(
          "cursors"
        )
      ).toBe(false);
      await act(async () => {
        finish(
          Response.json({
            entries: [log("2", "consumer")],
            cursors: { consumer: "new:1" },
            resetSources: [],
          })
        );
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.entries.map(({ id }) => id)).toEqual(["2"]);
      expect(result.current.isPreviousData).toBe(false);
    }
  );

  it("retains previous filter data after an error and retries with fresh cursors before accepting an empty result", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("1")],
          cursors: { agreement: "old:1" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({ error: "Logs unavailable" }, { status: 500 })
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [],
          cursors: { consumer: "new:1" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("2", "consumer")],
          cursors: { consumer: "new:2" },
          resetSources: [],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (value) => useIncrementalLogs(value),
      {
        initialProps: filters,
      }
    );
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("1"));
    rerender({ ...filters, source: "consumer" });
    await waitFor(() => expect(result.current.error).toBe("Logs unavailable"));
    expect(result.current.entries.map(({ id }) => id)).toEqual(["1"]);
    expect(result.current.isPreviousData).toBe(true);
    expect(result.current.loading).toBe(false);
    await act(() => result.current.refresh());
    expect(result.current.entries).toEqual([]);
    expect(result.current.isPreviousData).toBe(false);
    expect(result.current.error).toBe("");
    expect(
      new URL(String(fetchMock.mock.calls[2]?.[0])).searchParams.has("cursors")
    ).toBe(false);
    await act(() => result.current.refresh());
    expect(result.current.entries.map(({ id }) => id)).toEqual(["2"]);
    expect(
      JSON.parse(
        new URL(String(fetchMock.mock.calls[3]?.[0])).searchParams.get(
          "cursors"
        ) ?? "null"
      )
    ).toEqual({ consumer: "new:1" });
  });
  it("uses only source, level and search from the UI filter even when legacy filter properties exist", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ entries: [], cursors: {}, resetSources: [] })
      );
    vi.stubGlobal("fetch", fetchMock);
    const legacyFilters = {
      ...filters,
      source: "preset:backend",
      level: "error",
      search: "CID-42",
      service: "legacy-service",
      cid: "CID-42",
    };
    renderHook(() => useIncrementalLogs(legacyFilters));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const query = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
      "http://localhost"
    ).searchParams;
    expect(Object.fromEntries(query)).toEqual({
      source: "preset:backend",
      level: "error",
      search: "CID-42",
      limit: "500",
    });
  });
  it("keeps the most recent 500 lines newest-first across ascending server batches", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          entries: Array.from({ length: 500 }, (_, index) =>
            log(String(index + 1))
          ),
          cursors: { agreement: "500" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("501"), log("502")],
          cursors: { agreement: "502" },
          resetSources: [],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIncrementalLogs(filters));
    await waitFor(() => expect(result.current.entries).toHaveLength(500));
    await act(() => result.current.refresh());
    expect(result.current.entries.some((entry) => entry.id === "500")).toBe(
      true
    );
    expect(result.current.entries.slice(0, 4).map((entry) => entry.id)).toEqual(
      ["502", "501", "500", "499"]
    );
    expect(result.current.entries.at(-1)?.id).toBe("3");
    expect(result.current.entries).toHaveLength(500);
  });
  it("ignores an already cancelled refresh without changing loading or cached lines", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        entries: [log("1")],
        cursors: { agreement: "1" },
        resetSources: [],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIncrementalLogs(filters));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    const controller = new AbortController();
    controller.abort();
    await act(() => result.current.refresh(controller.signal));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.entries[0]?.id).toBe("1");
  });
  it("also cancels an explicit refresh when the filter changes", async () => {
    let finish: (response: Response) => void = () => undefined;
    const stale = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const response = (id: string) =>
      Response.json({
        entries: [log(id)],
        cursors: { agreement: id },
        resetSources: [],
      });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response("initial"))
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce(response("filtered"));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (value) => useIncrementalLogs(value),
      { initialProps: filters }
    );
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("initial"));
    let refreshing: Promise<void> | undefined;
    act(() => {
      refreshing = result.current.refresh();
    });
    const signal = fetchMock.mock.calls[1]?.[1]?.signal;
    rerender({ ...filters, source: "group:seed" });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("filtered"));
    try {
      expect(signal?.aborted).toBe(true);
    } finally {
      await act(async () => {
        finish(response("stale"));
        await refreshing;
      });
    }
    expect(result.current.entries.map((entry) => entry.id)).toEqual([
      "filtered",
    ]);
  });
  it("cancels the old filter request and ignores a late batch after changing source", async () => {
    let finish: (response: Response) => void = () => undefined;
    const stale = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("seed", "seed")],
          cursors: { seed: "1" },
          resetSources: [],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (value) => useIncrementalLogs(value),
      { initialProps: filters }
    );
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    rerender({ ...filters, source: "group:seed" });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("seed"));
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish(
        Response.json({
          entries: [log("stale")],
          cursors: { agreement: "1" },
          resetSources: [],
        })
      );
    });
    expect(result.current.entries.map((entry) => entry.id)).toEqual(["seed"]);
  });
  it("starts a fresh cursor and sends the selected source when only the source filter changes", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("initial")],
          cursors: { agreement: "1" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("worker", "consumer")],
          cursors: { consumer: "2" },
          resetSources: [],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (value) => useIncrementalLogs(value),
      { initialProps: filters }
    );
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("initial"));
    rerender({ ...filters, source: "consumer" });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("worker"));
    const url = new URL(
      String(fetchMock.mock.calls[1]?.[0]),
      "http://localhost"
    );
    expect(url.searchParams.get("source")).toBe("consumer");
    expect(url.searchParams.has("service")).toBe(false);
    expect(url.searchParams.has("cid")).toBe(false);
    expect(url.searchParams.has("cursors")).toBe(false);
    expect(result.current.entries).toHaveLength(1);
  });

  it("does not repeat a log delivered twice in one batch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          entries: [log("same"), log("same"), log("other")],
          cursors: { agreement: "next" },
          resetSources: [],
        })
      )
    );
    const { result } = renderHook(() => useIncrementalLogs(filters));
    await waitFor(() =>
      expect(result.current.entries.map(({ id }) => id)).toEqual([
        "same",
        "other",
      ])
    );
  });

  it("sends each source cursor, removes reset source entries, and retains other sources", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("a1"), log("b1", "consumer")],
          cursors: { agreement: "cursor-a", consumer: "cursor-b" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("a2")],
          cursors: { agreement: "cursor-new", consumer: "cursor-b" },
          resetSources: ["agreement"],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIncrementalLogs(filters));
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    await act(() => result.current.refresh());
    const secondUrl = new URL(
      String(fetchMock.mock.calls[1]?.[0]),
      "http://localhost"
    );
    expect(JSON.parse(secondUrl.searchParams.get("cursors") ?? "null")).toEqual(
      { agreement: "cursor-a", consumer: "cursor-b" }
    );
    expect(result.current.entries.map(({ id }) => id)).toEqual(["a2", "b1"]);
  });

  it("deduplicates source/id pairs and bounds the cache to the latest 500 entries", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          entries: Array.from({ length: 500 }, (_, index) =>
            log(String(index + 1))
          ),
          cursors: { agreement: "500" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("500"), log("501")],
          cursors: { agreement: "501" },
          resetSources: [],
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIncrementalLogs(filters));
    await waitFor(() => expect(result.current.entries).toHaveLength(500));
    await act(() => result.current.refresh());
    expect(result.current.entries).toHaveLength(500);
    expect(result.current.entries[0]?.id).toBe("501");
    expect(
      result.current.entries.filter(({ id }) => id === "500")
    ).toHaveLength(1);
    expect(result.current.entries.some(({ id }) => id === "1")).toBe(false);
    expect(
      new URL(
        String(fetchMock.mock.calls[0]?.[0]),
        "http://localhost"
      ).searchParams.get("limit")
    ).toBe("500");
  });

  it("starts a fresh cursor after changing filters and keeps the previous log data on request failure", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("old")],
          cursors: { agreement: "1" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          entries: [log("filtered")],
          cursors: { agreement: "2" },
          resetSources: [],
        })
      )
      .mockResolvedValueOnce(
        Response.json({ error: "Log file unavailable" }, { status: 500 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      (value) => useIncrementalLogs(value),
      { initialProps: filters }
    );
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("old"));
    rerender({
      ...filters,
      search: "correlation-123",
      level: "error",
    });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("filtered"));
    const filteredUrl = new URL(
      String(fetchMock.mock.calls[1]?.[0]),
      "http://localhost"
    );
    expect(filteredUrl.searchParams.has("cursors")).toBe(false);
    expect(filteredUrl.searchParams.has("cid")).toBe(false);
    expect(filteredUrl.searchParams.has("service")).toBe(false);
    expect(filteredUrl.searchParams.get("search")).toBe("correlation-123");
    expect(filteredUrl.searchParams.get("level")).toBe("error");
    await act(() => result.current.refresh());
    expect(result.current.error).toContain("Log file unavailable");
    expect(result.current.entries[0]?.id).toBe("filtered");
  });
});
