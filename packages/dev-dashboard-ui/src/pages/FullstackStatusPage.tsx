import { Terminal } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { ErrorAlert } from "../components/common/ErrorAlert";
import { FrontendLogsPanel } from "../components/FrontendLogsPanel";
import { FullstackRuntime } from "../components/FullstackRuntime";
import { FullstackStartup } from "../components/FullstackStartup";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { fullstackStatus } from "../lib/fullstackStatus";
import { useDashboardContext } from "../providers/DashboardProvider";
import { paths } from "../router/paths";

export function FullstackStatusPage() {
  const { status, connectionError } = useDashboardContext();
  const [logsVisible, setLogsVisible] = useState(false);
  if (!status) return null;
  const { frontend } = status;
  if (!frontend) return <Navigate to={paths.packages} replace />;
  const model = fullstackStatus(status, frontend, connectionError);
  return (
    <Card role="region" aria-labelledby="fullstack-title">
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle asChild>
          <h2 id="fullstack-title">Fullstack status</h2>
        </CardTitle>
        <Badge
          role="status"
          aria-label="Environment readiness"
          variant={
            model.readiness === "Needs attention"
              ? "warning"
              : model.readiness === "Starting"
                ? "working"
                : "success"
          }
        >
          {model.readiness}
        </Badge>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-6">
        {frontend.error && (
          <ErrorAlert title="Frontend startup" message={frontend.error} />
        )}
        {!frontend.available && !frontend.error && (
          <ErrorAlert message="Frontend runtime is unavailable. Backend status is still shown below." />
        )}
        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(240px,2fr)_minmax(0,3fr)]">
          <FullstackStartup
            state={frontend.state}
            phases={model.startupPhases}
            operations={status.operations}
          />
          <FullstackRuntime status={status} frontend={frontend} model={model} />
        </div>
        <Separator />
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          aria-expanded={logsVisible}
          aria-controls="frontend-logs"
          onClick={() => setLogsVisible((visible) => !visible)}
        >
          <Terminal data-icon="inline-start" aria-hidden="true" />
          {logsVisible ? "Hide frontend logs" : "Show frontend logs"}
        </Button>
        {logsVisible && (
          <div id="frontend-logs" className="min-w-0">
            <FrontendLogsPanel enabled={frontend.available} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
