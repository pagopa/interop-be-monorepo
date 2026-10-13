import { PackageCatalogue } from "../components/PackageCatalogue";
import { useLogNavigation } from "../hooks/useLogRoute";
import { usePackageFilter } from "../hooks/usePackageFilter";
import { useDashboardContext } from "../providers/DashboardProvider";

export function PackagesPage() {
  const dashboard = useDashboardContext();
  const { filter, changeFilter } = usePackageFilter();
  const viewLogs = useLogNavigation();
  if (!dashboard.status) return null;
  return (
    <PackageCatalogue
      packages={dashboard.status.packages}
      seedPackages={dashboard.status.seedPackages}
      presets={dashboard.status.presets}
      filter={filter}
      onFilterChange={changeFilter}
      busy={dashboard.busy}
      actionError={dashboard.actionError}
      onDismissError={dashboard.dismissError}
      onAction={dashboard.runAction}
      onLogs={viewLogs}
    />
  );
}
