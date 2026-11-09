import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { DashboardQueries } from "../api/dashboard/dashboard.queries";
import { errorMessage } from "../lib/utils";

export function useRuntimeStatus() {
  const client = useQueryClient();
  const query = useQuery(DashboardQueries.status());
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return;
      // An explicit refresh supersedes an older poll, including the first pending load.
      await client.cancelQueries({
        queryKey: DashboardQueries.status().queryKey,
      });
      try {
        await client.fetchQuery({ ...DashboardQueries.status(), staleTime: 0 });
      } catch {
        // The query exposes its error while retaining the last successfully validated status.
      }
    },
    [client]
  );
  return {
    status: query.data,
    connectionError: query.error ? errorMessage(query.error) : "",
    refresh,
  };
}
