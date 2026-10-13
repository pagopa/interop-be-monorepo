import { PresetPanel } from "../components/PresetPanel";
import { useDashboardContext } from "../providers/DashboardProvider";

export function PresetsPage() {
  const dashboard = useDashboardContext();
  if (!dashboard.status) return null;
  return (
    <PresetPanel
      presets={dashboard.status.presets}
      packages={dashboard.status.packages}
      frontendAvailable={dashboard.status.frontendAvailable}
      busy={dashboard.busy}
      actionError={dashboard.actionError}
      actionFailures={dashboard.actionFailures}
      onAction={dashboard.runAction}
      onSave={dashboard.savePreset}
      onRemove={dashboard.removePreset}
    />
  );
}
