import { RefreshCw } from "lucide-react";

import { useDashboardContext } from "../../providers/DashboardProvider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export function RuntimeToolbar() {
  const dashboard = useDashboardContext();
  const { status } = dashboard;
  const running =
    status?.packages.filter((item) => item.state === "running").length ?? 0;
  const failed =
    status?.packages.filter((item) => item.state === "failed").length ?? 0;
  return (
    <section
      aria-label="Runtime status"
      className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-end"
    >
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Development dashboard
        </h1>
        {status && (
          <p className="text-xs text-muted-foreground">
            {running}/{status.packages.length} backend packages running ·{" "}
            {
              status.infrastructure.filter((item) => item.state === "running")
                .length
            }
            /{status.infrastructure.length} containers running
            {failed > 0 && (
              <Badge variant="destructive" className="ml-2">
                {failed} failed packages
              </Badge>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          aria-label="Refresh runtime status"
          title="Refresh runtime status"
          onClick={() => void dashboard.refresh()}
        >
          <RefreshCw data-icon="inline-start" />
          <span className="sr-only sm:not-sr-only">Refresh</span>
        </Button>
      </div>
    </section>
  );
}
