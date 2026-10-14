import { InfrastructurePanel } from "../components/InfrastructurePanel";
import { useLogNavigation } from "../hooks/useLogRoute";
import { useDashboardContext } from "../providers/DashboardProvider";

export function InfrastructurePage() {
  const dashboard = useDashboardContext();
  const viewLogs = useLogNavigation();
  if (!dashboard.status) return null;
  return (
    <InfrastructurePanel
      infrastructure={dashboard.status.infrastructure}
      busy={dashboard.busy}
      failure={dashboard.actionFailures.infra}
      onAction={dashboard.runAction}
      onLogs={viewLogs}
    />
  );
}
