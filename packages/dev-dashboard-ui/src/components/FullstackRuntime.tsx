import type {
  DashboardStatus,
  FrontendStatus,
} from "pagopa-interop-dev-dashboard-contracts";

import { Terminal } from "lucide-react";
import { Link } from "react-router-dom";

import { fullstackStatus } from "../lib/fullstackStatus";
import { paths } from "../router/paths";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type RuntimeRow = {
  name: string;
  state: string;
  detail?: string;
  source: string;
};

function CurrentServices({
  title,
  id,
  rows,
  empty,
}: {
  title: string;
  id: string;
  rows: RuntimeRow[];
  empty: string;
}) {
  return (
    <section
      role="region"
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-base font-semibold">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          {rows.filter((row) => row.state === "running").length}/{rows.length}{" "}
          running
        </span>
      </div>
      {rows.length ? (
        <Table density="compact">
          <TableCaption className="sr-only">{title}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">State</TableHead>
              <TableHead scope="col">
                <span className="sr-only">Logs</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell>
                  <code className="text-xs [overflow-wrap:anywhere]">
                    {row.name}
                  </code>
                  {row.detail && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {row.detail}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge state={row.state} />
                </TableCell>
                <TableCell className="w-12">
                  <Button asChild variant="ghost" size="icon">
                    <Link
                      to={`${paths.logs}?${new URLSearchParams({ source: row.source })}`}
                      aria-label={`Logs for ${row.name}`}
                      title={`Logs for ${row.name}`}
                    >
                      <Terminal aria-hidden="true" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export function FullstackRuntime({
  status,
  frontend,
  model,
}: {
  status: DashboardStatus;
  frontend: FrontendStatus;
  model: ReturnType<typeof fullstackStatus>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section
        role="region"
        aria-labelledby="current-runtime-title"
        className="flex flex-col gap-3"
      >
        <h3 id="current-runtime-title" className="text-base font-semibold">
          Current runtime
        </h3>
        <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 text-sm">
          <dt>Frontend</dt>
          <dd>
            <StatusBadge
              state={
                !frontend.available
                  ? "unavailable"
                  : frontend.running
                    ? "running"
                    : "stopped"
              }
            />
          </dd>
          <dt>API target</dt>
          <dd>
            <Badge variant="outline">
              {model.local ? "Local backend" : "Shared development"}
            </Badge>
          </dd>
          <dt>Local data</dt>
          <dd>
            <Badge variant={status.seedReady ? "success" : "outline"}>
              {status.seedReady ? "Seeded" : "Not seeded"}
            </Badge>
          </dd>
        </dl>
        {!model.local && (
          <p className="text-xs text-muted-foreground">
            Frontend uses shared development APIs. Local services and data below
            are not required.
          </p>
        )}
      </section>
      <Separator />
      <CurrentServices
        title="Current infrastructure"
        id="current-infra-title"
        rows={status.infrastructure.map((item) => ({
          name: item.name,
          state: item.state,
          detail: [
            item.status,
            item.exitCode === undefined
              ? undefined
              : `Exit code ${item.exitCode}`,
          ]
            .filter(Boolean)
            .join(" · "),
          source: `infra:${item.name}`,
        }))}
        empty="No local infrastructure found."
      />
      <Separator />
      <CurrentServices
        title="Current backend services"
        id="current-backend-title"
        rows={model.members.map((member) => ({
          name: member.name,
          state: member.package?.state ?? "unavailable",
          detail: member.package?.error,
          source: member.name,
        }))}
        empty="The Frontend backend preset is unavailable or has no members."
      />
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link to={`${paths.packages}?preset=frontend-full`}>
          Open backend packages
        </Link>
      </Button>
    </div>
  );
}
