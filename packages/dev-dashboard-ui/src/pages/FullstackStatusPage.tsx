import { ExternalLink, Terminal } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { ErrorAlert } from "../components/common/ErrorAlert";
import { FrontendLogsPanel } from "../components/FrontendLogsPanel";
import { FullstackStartup } from "../components/FullstackStartup";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { useDashboardContext } from "../providers/DashboardProvider";
import { paths } from "../router/paths";

export function FullstackStatusPage() {
  const { status } = useDashboardContext();
  const [logsVisible, setLogsVisible] = useState(false);
  if (!status) return null;
  const { frontend } = status;
  if (!frontend) return <Navigate to={paths.packages} replace />;
  const phases = frontend.phases.filter(
    (phase) =>
      frontend.mode !== "dev" ||
      !["infra", "backend", "seed", "identity"].includes(phase.id)
  );
  return (
    <Card
      role="region"
      aria-labelledby="fullstack-title"
      className="w-full max-w-3xl"
    >
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle asChild>
          <h2 id="fullstack-title">Fullstack status</h2>
        </CardTitle>
        {frontend.running ? (
          <Button asChild size="sm">
            <a
              href="http://localhost:3000/ui/it/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink data-icon="inline-start" aria-hidden="true" />
              Open frontend
            </a>
          </Button>
        ) : (
          <span title="Available when the frontend is running.">
            <Button
              size="sm"
              disabled
              title="Available when the frontend is running."
            >
              <ExternalLink data-icon="inline-start" aria-hidden="true" />
              Open frontend
            </Button>
          </span>
        )}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-6">
        {frontend.error && (
          <ErrorAlert title="Frontend startup" message={frontend.error} />
        )}
        {!frontend.available && !frontend.error && (
          <ErrorAlert message="Frontend runtime is unavailable. Startup details remain available." />
        )}
        <FullstackStartup
          state={frontend.state}
          phases={phases}
          mode={frontend.mode}
          operations={status.operations}
        />
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
