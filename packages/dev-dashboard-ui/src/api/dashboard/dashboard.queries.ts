import { queryOptions } from "@tanstack/react-query";

import { DashboardService } from "./dashboard.services";

function status() {
  return queryOptions({
    queryKey: ["dashboard", "status"],
    queryFn: ({ signal }) => DashboardService.getStatus(signal),
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

function identities(revision = "") {
  return queryOptions({
    queryKey: ["dashboard", "identities", revision],
    queryFn: ({ signal }) => DashboardService.getIdentities(signal),
    staleTime: Infinity,
  });
}

export const DashboardQueries = { status, identities };
