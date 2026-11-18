import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useLogFilters } from "../../src/hooks/useLogFilters";

const storageKey = "pdnd-dev-dashboard.logs.groupByPackage";
const props = {
  sources: [],
  presets: [],
  selectedSource: "",
  selectedLevel: "",
  onFiltersChange: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json({ entries: [], cursors: {}, resetSources: [] })
      )
  );
});

describe("log grouping preference", () => {
  it("persists enabled grouping and restores it on the first render after remount", async () => {
    const first = renderHook(() => useLogFilters(props));
    expect(first.result.current.groupByPackage).toBe(false);
    act(() => first.result.current.setGroupByPackage((current) => !current));
    expect(first.result.current.groupByPackage).toBe(true);
    expect(window.localStorage.getItem(storageKey)).toBe("true");
    first.unmount();

    const renderedPreferences: boolean[] = [];
    const restored = renderHook(() => {
      const filters = useLogFilters(props);
      renderedPreferences.push(filters.groupByPackage);
      return filters;
    });
    expect(restored.result.current.groupByPackage).toBe(true);
    expect(renderedPreferences).not.toContain(false);
    await waitFor(() =>
      expect(restored.result.current.logs.loading).toBe(false)
    );
  });

  it("persists disabled grouping after toggling an enabled preference", async () => {
    window.localStorage.setItem(storageKey, "true");
    const first = renderHook(() => useLogFilters(props));
    expect(first.result.current.groupByPackage).toBe(true);
    act(() => first.result.current.setGroupByPackage(false));
    expect(first.result.current.groupByPackage).toBe(false);
    expect(window.localStorage.getItem(storageKey)).toBe("false");
    first.unmount();

    const restored = renderHook(() => useLogFilters(props));
    expect(restored.result.current.groupByPackage).toBe(false);
    await waitFor(() =>
      expect(restored.result.current.logs.loading).toBe(false)
    );
  });

  it.each([null, "false", "invalid JSON", '"true"', "1", "{}"])(
    "defaults to ungrouped logs for missing, false or invalid storage: %s",
    async (stored) => {
      if (stored !== null) window.localStorage.setItem(storageKey, stored);
      const { result } = renderHook(() => useLogFilters(props));
      expect(result.current.groupByPackage).toBe(false);
      await waitFor(() => expect(result.current.logs.loading).toBe(false));
    }
  );

  it.each(["getItem", "setItem"] satisfies Array<"getItem" | "setItem">)(
    "keeps grouping usable when storage %s throws",
    async (method) => {
      vi.spyOn(window.Storage.prototype, method).mockImplementation(() => {
        throw new Error("Storage unavailable");
      });
      const { result } = renderHook(() => useLogFilters(props));
      expect(result.current.groupByPackage).toBe(false);
      act(() => result.current.setGroupByPackage(true));
      expect(result.current.groupByPackage).toBe(true);
      act(() => result.current.setGroupByPackage((current) => !current));
      expect(result.current.groupByPackage).toBe(false);
      await waitFor(() => expect(result.current.logs.loading).toBe(false));
    }
  );

  it("keeps grouping usable when access to local storage is blocked", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("Storage access blocked");
    });
    const { result } = renderHook(() => useLogFilters(props));
    expect(result.current.groupByPackage).toBe(false);
    act(() => result.current.setGroupByPackage(true));
    expect(result.current.groupByPackage).toBe(true);
    act(() => result.current.setGroupByPackage(false));
    expect(result.current.groupByPackage).toBe(false);
    await waitFor(() => expect(result.current.logs.loading).toBe(false));
  });
});
