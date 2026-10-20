import { Navigate } from "react-router-dom";

import { LogsPanel } from "../components/LogsPanel";
import { useLogRoute } from "../hooks/useLogRoute";
import { useDashboardContext } from "../providers/DashboardProvider";
import { paths } from "../router/paths";

export function LogsPage() {
  const { status } = useDashboardContext();
  const route = useLogRoute();
  if (route.source === "group:seed") {
    const query = new URLSearchParams({ source: "preset:tenant-seeding" });
    if (route.level) query.set("level", route.level);
    return <Navigate to={`${paths.logs}?${query}`} replace />;
  }
  return (
    <LogsPanel
      sources={status?.logSources ?? []}
      presets={status?.presets ?? []}
      selectedSource={route.source}
      selectedLevel={route.level}
      onFiltersChange={route.changeFilters}
    />
  );
}
