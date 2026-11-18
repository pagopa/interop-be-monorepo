import type { DashboardStatus } from "pagopa-interop-dev-dashboard-contracts";

import { join } from "node:path";

import type { Supervisor } from "./supervisorService.js";

import {
  CONTAINER_EXIT_CODES,
  DASHBOARD_PATHS,
  DASHBOARD_TIMING,
  LOG_LIMITS,
  LOG_SOURCES,
  LOG_SOURCE_PREFIXES,
} from "../config/constants.js";
import {
  Container,
  InspectedContainerState,
  type Child,
  type Command,
  type Driver,
} from "../model/domain/models.js";
import { errorMessage } from "../utilities/errorUtils.js";

type InfrastructureService = {
  refresh(): Promise<void>;
  start(): void;
  shutdown(): Promise<void>;
};

type LogTail = { fingerprint: string; child: Child; hasExited: () => boolean };
type InfrastructureStatus = DashboardStatus["infrastructure"][number];

const parseContainers = (output: string): Container[] => {
  const trimmed = output.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("["))
    return Container.array().parse(JSON.parse(trimmed));
  return trimmed.split("\n").map((line) => Container.parse(JSON.parse(line)));
};

function parseInspection(line: string): InspectedContainerState[] {
  try {
    const result = InspectedContainerState.safeParse(JSON.parse(line));
    return result.success ? [result.data] : [];
  } catch {
    return [];
  }
}

function requiresInspection(row: Container): boolean {
  return (
    row.State === "exited" &&
    (row.ExitCode === CONTAINER_EXIT_CODES.sigkill ||
      row.ExitCode === CONTAINER_EXIT_CODES.sigterm)
  );
}

function inspectionForContainer(
  row: Container | undefined,
  service: string,
  inspectedStates: InspectedContainerState[]
): InspectedContainerState | undefined {
  const identifier = row?.ID ?? service;
  const matchingStates = inspectedStates.filter(
    (inspected) =>
      inspected.ID === identifier ||
      (row?.ID &&
        /^[a-f0-9]{12,64}$/i.test(row.ID) &&
        /^[a-f0-9]{12,64}$/i.test(inspected.ID) &&
        inspected.ID.startsWith(row.ID))
  );
  return matchingStates.length === 1 ? matchingStates[0] : undefined;
}

function stoppedBySignal(
  row: Container,
  inspected: InspectedContainerState | undefined
): boolean {
  return (
    row.State === "exited" &&
    !inspected?.OOMKilled &&
    !inspected?.Error &&
    (row.ExitCode === CONTAINER_EXIT_CODES.sigterm ||
      (row.ExitCode === CONTAINER_EXIT_CODES.sigkill &&
        inspected?.OOMKilled === false &&
        inspected.Error === ""))
  );
}

function containerState(
  row: Container | undefined,
  inspected: InspectedContainerState | undefined
): InfrastructureStatus["state"] {
  if (!row) return "stopped";
  if (row.State === "running") return "running";
  if (row.State === "restarting" || row.State === "created") return "starting";
  if (
    (row.ExitCode && !stoppedBySignal(row, inspected)) ||
    row.State === "dead"
  )
    return "failed";
  return "stopped";
}

function infrastructureStatus(
  name: string,
  row: Container | undefined,
  inspectedStates: InspectedContainerState[]
): InfrastructureStatus {
  return {
    name,
    state: containerState(
      row,
      inspectionForContainer(row, name, inspectedStates)
    ),
    ...(row?.Status ? { status: row.Status } : {}),
    ...(row?.ExitCode !== undefined ? { exitCode: row.ExitCode } : {}),
  };
}

function indexContainers(rows: Container[]): Map<string, Container> {
  const byService = new Map<string, Container>();
  rows.forEach((row) => {
    if (!byService.has(row.Service)) byService.set(row.Service, row);
  });
  return byService;
}

export function infrastructureServiceBuilder(
  root: string,
  driver: Driver,
  supervisor: Supervisor
): InfrastructureService {
  let services: string[] = [];
  const tails = new Map<string, LogTail>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let refreshing = false;

  function command(args: string[]): Command {
    return {
      source: LOG_SOURCES.orchestration,
      executable: "docker",
      args: ["compose", "-f", join(root, DASHBOARD_PATHS.composeFile), ...args],
      cwd: root,
      timeoutMs: DASHBOARD_TIMING.inventoryCommandTimeoutMs,
    };
  }

  async function inspectStates(
    identifiers: string[]
  ): Promise<InspectedContainerState[]> {
    if (!identifiers.length) return [];
    try {
      const output = await driver.run(
        {
          source: LOG_SOURCES.orchestration,
          executable: "docker",
          args: [
            "inspect",
            "--format",
            '{"ID":{{json .Id}},"OOMKilled":{{json .State.OOMKilled}},"Error":{{json .State.Error}}}',
            ...identifiers,
          ],
          cwd: root,
          timeoutMs: DASHBOARD_TIMING.inventoryCommandTimeoutMs,
        },
        () => undefined
      );
      return output.split("\n").flatMap(parseInspection);
    } catch {
      // Missing inspection must not interrupt inventory or log collection.
      return [];
    }
  }

  async function refreshTail(row: Container): Promise<void> {
    const fingerprint = `${row.ID ?? row.Service}:${row.State}`;
    const previous = tails.get(row.Service);
    if (previous?.fingerprint === fingerprint && !previous.hasExited()) return;
    const source = `${LOG_SOURCE_PREFIXES.infrastructure}${row.Service}`;
    if (previous) {
      await previous.child.stop();
      supervisor.logs.reset(source);
    }
    let exited = false;
    const child = await driver.start(
      {
        ...command([
          "logs",
          "--no-color",
          "--no-log-prefix",
          "--timestamps",
          "--follow",
          `--tail=${LOG_LIMITS.containerTailLines}`,
          row.Service,
        ]),
        source,
      },
      (line) => supervisor.logs.append(source, line),
      () => {
        exited = true;
      }
    );
    tails.set(row.Service, { fingerprint, child, hasExited: () => exited });
  }

  async function reconcileTails(
    monitoredRows: Container[],
    currentServices: Set<string>
  ): Promise<void> {
    for (const row of monitoredRows) {
      if (stopped) break;
      await refreshTail(row);
    }
    for (const [service, tail] of tails) {
      if (!currentServices.has(service)) {
        await tail.child.stop();
        tails.delete(service);
      }
    }
  }

  async function refresh(): Promise<void> {
    if (stopped || refreshing) return;
    refreshing = true;
    try {
      if (!services.length)
        services = (
          await driver.run(command(["config", "--services"]), () => undefined)
        )
          .trim()
          .split("\n")
          .filter(
            (name) =>
              /^[a-zA-Z0-9_-]+$/.test(name) && !name.includes("dashboard")
          );
      const rows = parseContainers(
        await driver.run(
          command(["ps", "--all", "--format", "json"]),
          () => undefined
        )
      );
      const configuredServices = new Set(services);
      const monitoredRows = rows.filter((row) =>
        configuredServices.has(row.Service)
      );
      const rowsByService = indexContainers(rows);
      const inspectedStates = await inspectStates(
        monitoredRows
          .filter(requiresInspection)
          .map((row) => row.ID ?? row.Service)
      );
      const infrastructure = services.map((name) =>
        infrastructureStatus(name, rowsByService.get(name), inspectedStates)
      );
      supervisor.setInfrastructure(infrastructure);
      await reconcileTails(monitoredRows, new Set(rowsByService.keys()));
    } catch (error) {
      if (!stopped)
        supervisor.logs.append(
          LOG_SOURCES.orchestration,
          `WARN Infrastructure inventory: ${errorMessage(error)}`
        );
    } finally {
      refreshing = false;
    }
  }

  function start(): void {
    const tick = async (): Promise<void> => {
      await refresh();
      if (!stopped)
        timer = setTimeout(() => {
          void tick();
        }, DASHBOARD_TIMING.inventoryIntervalMs);
    };
    void tick();
  }

  async function shutdown(): Promise<void> {
    stopped = true;
    if (timer) clearTimeout(timer);
    await Promise.all([...tails.values()].map((tail) => tail.child.stop()));
    tails.clear();
  }

  return {
    refresh,
    start,
    shutdown,
  };
}
