import { LogsPanel } from "../components/LogsPanel";
import { useLogRoute } from "../hooks/useLogRoute";
import { useDashboardContext } from "../providers/DashboardProvider";

export function LogsPage() {
  const { status } = useDashboardContext();
  const route = useLogRoute();
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
