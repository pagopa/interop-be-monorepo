import { useCallback, useEffect, useRef, useState } from "react";

import {
  DashboardService,
  type LogFilters as RequestLogFilters,
  type LogsResponse,
} from "../api/dashboard/dashboard.services";
import { errorMessage } from "../lib/utils";

type LogFilters = Required<
  Pick<RequestLogFilters, "source" | "level" | "search">
>;

export function useIncrementalLogs(filters: LogFilters) {
  const { source, level, search } = filters;
  const filterKey = JSON.stringify([source, level, search]);
  const cache = useRef<{ key: string; data?: LogsResponse }>({
    key: filterKey,
  });
  const generation = useRef(0);
  const cancellation = useRef<AbortController>();
  const [displayed, setDisplayed] = useState<{
    key?: string;
    data: LogsResponse;
  }>({ data: { entries: [], cursors: {}, resetSources: [] } });
  const [request, setRequest] = useState({
    key: filterKey,
    error: "",
    loading: true,
  });
  const inFlight = useRef<{ key: string; generation: number }>();

  const refresh = useCallback(
    async (signal = cancellation.current?.signal) => {
      if (signal?.aborted || cache.current.key !== filterKey) return;
      if (
        inFlight.current?.key === filterKey &&
        inFlight.current.generation === generation.current
      )
        return;
      const currentGeneration = generation.current;
      const requestId = { key: filterKey, generation: currentGeneration };
      inFlight.current = requestId;
      setRequest({ key: filterKey, error: "", loading: true });
      try {
        const incoming = await DashboardService.getLogs(
          {
            source,
            level,
            search,
            limit: 500,
            cursors: cache.current.data?.cursors,
          },
          signal
        );
        if (
          signal?.aborted ||
          currentGeneration !== generation.current ||
          cache.current.key !== filterKey
        )
          return;
        const reset = new Set(incoming.resetSources);
        const keys = new Set<string>();
        const uniqueIncoming = incoming.entries.filter((entry) => {
          const key = `${entry.source}:${entry.id}`;
          if (keys.has(key)) return false;
          keys.add(key);
          return true;
        });
        const retained = (cache.current.data?.entries ?? []).filter(
          (entry) =>
            !reset.has(entry.source) && !keys.has(`${entry.source}:${entry.id}`)
        );
        const merged = {
          ...incoming,
          // The API's global sequence IDs arrive ascending; sort before truncating
          // so repeated and multi-line deltas always retain the most recent 500 lines.
          entries: [...uniqueIncoming, ...retained]
            .sort((left, right) => Number(right.id) - Number(left.id))
            .slice(0, 500),
        };
        cache.current = { key: filterKey, data: merged };
        setDisplayed({ key: filterKey, data: merged });
      } catch (failure) {
        if (!signal?.aborted && currentGeneration === generation.current)
          setRequest({
            key: filterKey,
            error: errorMessage(failure),
            loading: false,
          });
      } finally {
        if (inFlight.current === requestId) inFlight.current = undefined;
        if (!signal?.aborted && currentGeneration === generation.current)
          setRequest((current) => ({ ...current, loading: false }));
      }
    },
    [filterKey, source, level, search]
  );

  // Logs are a cursor stream, not a replaceable resource: poll and merge each delta,
  // aborting the old filter generation so stale batches cannot contaminate the new stream.
  useEffect(() => {
    generation.current += 1;
    cache.current = { key: filterKey };
    // Keep the displayed snapshot until this filter resolves. Its entries never
    // enter the new cursor cache, including after an error or an empty response.
    const controller = new AbortController();
    cancellation.current = controller;
    void refresh(controller.signal);
    const timer = window.setInterval(
      () => void refresh(controller.signal),
      2000
    );
    return () => {
      generation.current += 1;
      controller.abort();
      if (cancellation.current === controller) cancellation.current = undefined;
      window.clearInterval(timer);
      inFlight.current = undefined;
    };
  }, [filterKey, refresh]);

  return {
    entries: displayed.data.entries,
    hasResolved: displayed.key !== undefined,
    isPreviousData: displayed.key !== undefined && displayed.key !== filterKey,
    error: request.key === filterKey ? request.error : "",
    loading: request.key !== filterKey || request.loading,
    refresh,
  };
}
