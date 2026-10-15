import type {
  FrontendStatus,
  Operation,
  Phase,
} from "pagopa-interop-dev-dashboard-contracts";

import { Check, Circle, LoaderCircle, Minus, Terminal, X } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "../lib/utils";
import { paths } from "../router/paths";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

function PhaseState({ phase }: { phase: Phase }) {
  return phase.state === "running" ? (
    <Badge variant="working" format="status">
      Running
    </Badge>
  ) : (
    <StatusBadge state={phase.state} />
  );
}

function PhaseIcon({ state }: { state: Phase["state"] }) {
  const Icon =
    state === "passed"
      ? Check
      : state === "failed"
        ? X
        : state === "running"
          ? LoaderCircle
          : state === "skipped"
            ? Minus
            : Circle;
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0",
        state === "running" && "animate-spin text-primary",
        state === "failed" && "text-destructive",
        state === "passed" && "text-success-foreground",
        (state === "pending" || state === "skipped") && "text-muted-foreground"
      )}
    />
  );
}

export function FullstackStartup({
  state,
  phases,
  mode,
  operations,
}: {
  state: FrontendStatus["state"];
  phases: Phase[];
  mode: FrontendStatus["mode"];
  operations: Operation[];
}) {
  return (
    <section role="region" aria-labelledby="startup-title" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 id="startup-title" className="text-base font-semibold">
            Current startup
          </h3>
          {mode && (
            <span className="text-xs text-muted-foreground">
              {mode === "dev" ? "Shared development" : "Local"}
            </span>
          )}
        </div>
        <StatusBadge state={state === "running" ? "starting" : state} />
      </div>
      {!phases.length && (
        <p className="text-sm text-muted-foreground">
          Waiting for the frontend launcher to report startup progress.
        </p>
      )}
      <ol className="flex flex-col">
        {phases.map((phase, index) => {
          const operation = operations.find(
            (item) => item.id === phase.operationId
          );
          const source =
            phase.id === "backend"
              ? "preset:frontend-full"
              : phase.id === "seed"
                ? "group:seed"
                : "orchestration";
          return (
            <li key={phase.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < phases.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-3 top-6 border-l"
                />
              )}
              <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
                <PhaseIcon state={phase.state} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{phase.label}</span>
                  <PhaseState phase={phase} />
                </div>
                {phase.error && (
                  <p className="break-words text-xs text-destructive">
                    {phase.error}
                  </p>
                )}
                {operation && (
                  <>
                    <ul
                      className="flex flex-col gap-2"
                      aria-label={`${phase.label} details`}
                    >
                      {operation.phases.map((subphase) => (
                        <li
                          key={subphase.id}
                          className="flex flex-col gap-1 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>{subphase.label}</span>
                            <PhaseState phase={subphase} />
                          </div>
                          {subphase.error && (
                            <p className="break-words text-destructive">
                              {subphase.error}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                    {operation.error && operation.error !== phase.error && (
                      <p className="break-words text-xs text-destructive">
                        {operation.error}
                      </p>
                    )}
                  </>
                )}
                {(operation ||
                  ["infra", "backend", "seed"].includes(phase.id)) && (
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    aria-label={
                      phase.id === "backend"
                        ? "Backend startup logs"
                        : `${phase.label} logs`
                    }
                  >
                    <Link
                      to={`${paths.logs}?${new URLSearchParams({ source })}`}
                    >
                      <Terminal data-icon="inline-start" aria-hidden="true" />
                      Logs
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
