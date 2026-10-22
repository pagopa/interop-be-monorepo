import type {
  DashboardAction,
  Infrastructure,
} from "pagopa-interop-dev-dashboard-contracts";

import { LoaderCircle, Play, Square, Terminal, Trash2 } from "lucide-react";

import type { ActionFailure } from "../hooks/useDashboard";

import { paths } from "../router/paths";
import { ErrorAlert } from "./common/ErrorAlert";
import { Toolbar } from "./common/Toolbar";
import { ConfirmDialog } from "./ConfirmDialog";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "./ui/empty";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type Props = {
  infrastructure: Infrastructure[];
  busy: Record<string, string>;
  failure?: ActionFailure;
  onAction: (
    action: DashboardAction,
    key: string | string[]
  ) => Promise<boolean>;
  onLogs: (source: string) => void;
};

export function InfrastructurePanel({
  infrastructure,
  busy,
  failure,
  onAction,
  onLogs,
}: Props) {
  const starting = Boolean(busy["infra-start"]);
  const stopping = Boolean(busy["infra-stop"]);
  const resetting = Boolean(busy["infra-reset"]);
  const pending = Boolean(busy.infra) || starting || stopping || resetting;
  return (
    <Card role="region" aria-labelledby="infra-title">
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle asChild>
          <h2 id="infra-title">Local infrastructure</h2>
        </CardTitle>
        <Toolbar role="group" aria-label="Infrastructure actions">
          <ConfirmDialog
            trigger={
              <Button
                variant="destructive-outline"
                size="sm"
                className="w-20"
                aria-label="Reset infrastructure"
                aria-busy={resetting}
                disabled={pending}
              >
                {resetting ? (
                  <>
                    <LoaderCircle
                      data-icon="inline-start"
                      aria-hidden="true"
                      className="animate-spin"
                    />
                    <span className="sr-only" role="status">
                      Resetting infrastructure
                    </span>
                  </>
                ) : (
                  <Trash2 data-icon="inline-start" aria-hidden="true" />
                )}
                Reset
              </Button>
            }
            title="Delete local infrastructure data?"
            description="This deletes local Docker infrastructure volumes and local data before recreating the containers. Running backend processes may need to be restarted. This cannot be undone."
            confirmLabel="Delete data and reset"
            confirmIcon={Trash2}
            busy={pending}
            onConfirm={() =>
              onAction({ type: "infra.reset", confirm: true }, [
                "infra",
                "infra-reset",
              ])
            }
          />
          <Button
            size="sm"
            variant="outline"
            className="w-20"
            aria-label="Stop infrastructure"
            aria-busy={stopping}
            disabled={pending}
            onClick={() =>
              void onAction({ type: "infra.stop" }, ["infra", "infra-stop"])
            }
          >
            {stopping ? (
              <>
                <LoaderCircle
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="animate-spin"
                />
                <span className="sr-only" role="status">
                  Stopping infrastructure
                </span>
              </>
            ) : (
              <Square data-icon="inline-start" aria-hidden="true" />
            )}
            Stop
          </Button>
          <Button
            size="sm"
            className="w-20"
            aria-label="Start infrastructure"
            aria-busy={starting}
            disabled={pending}
            onClick={() =>
              void onAction({ type: "infra.start" }, ["infra", "infra-start"])
            }
          >
            {starting ? (
              <>
                <LoaderCircle
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="animate-spin"
                />
                <span className="sr-only" role="status">
                  Starting infrastructure
                </span>
              </>
            ) : (
              <Play data-icon="inline-start" aria-hidden="true" />
            )}
            Start
          </Button>
        </Toolbar>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {failure && (
          <ErrorAlert
            title={
              failure.kind === "infra.start"
                ? "Infrastructure start failed"
                : failure.kind === "infra.stop"
                  ? "Infrastructure stop failed"
                  : "Infrastructure reset failed"
            }
            message={failure.message}
            logsHref={`${paths.logs}?${new URLSearchParams({ source: "orchestration", level: "error" })}`}
          />
        )}
        <Table density="compact" className="min-w-[560px]">
          <TableCaption className="sr-only">
            Local infrastructure containers
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Container</TableHead>
              <TableHead scope="col">State</TableHead>
              <TableHead scope="col">Detail</TableHead>
              <TableHead scope="col">Logs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {infrastructure.map((container) => (
              <TableRow key={container.name}>
                <TableCell>
                  <code>{container.name}</code>
                </TableCell>
                <TableCell>
                  <StatusBadge state={container.state} />
                </TableCell>
                <TableCell>
                  {container.status ?? "No additional status"}
                  {container.exitCode !== undefined && (
                    <span> · Exit code {container.exitCode}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Logs for ${container.name}`}
                    onClick={() => onLogs(`infra:${container.name}`)}
                  >
                    <Terminal data-icon="inline-start" aria-hidden="true" />
                    Logs
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!infrastructure.length && (
          <Empty>
            <EmptyHeader>
              <EmptyDescription>
                No containers found. Start infrastructure to create the local
                environment.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
