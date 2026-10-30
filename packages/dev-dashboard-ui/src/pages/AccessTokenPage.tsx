import { TokenPanel } from "../components/TokenPanel";
import { useDashboardContext } from "../providers/DashboardProvider";

export function AccessTokenPage() {
  const dashboard = useDashboardContext();
  if (!dashboard.status) return null;
  return (
    <TokenPanel
      packages={dashboard.status.packages}
      seedPackages={dashboard.status.seedPackages}
      seedReady={dashboard.status.seedReady}
      operations={dashboard.status.operations}
      busy={dashboard.busy.seed}
      prepareBusy={dashboard.busy["seed-prepare"]}
      onSeed={() => dashboard.runAction({ type: "seed" }, "seed")}
      onPrepare={() =>
        dashboard.runAction({ type: "seed.prepare" }, "seed-prepare")
      }
    />
  );
}
