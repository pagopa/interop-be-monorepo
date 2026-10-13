import type { Package } from "pagopa-interop-dev-dashboard-contracts";

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { Child, Command, Driver } from "../model/domain/models.js";
import type { logServiceBuilder } from "./logService.js";

import {
  DASHBOARD_TIMING,
  LOCAL_ENDPOINTS,
  MAX_PORT,
  PACKAGE_LAYOUT,
  PACKAGE_NAMES,
  PACKAGE_READINESS_PATHS,
} from "../config/constants.js";
import { errorMessage } from "../utilities/errorUtils.js";

type ApplicationServiceOptions = {
  beRoot: string;
  driver: Driver;
  packages: Package[];
  getPackage: (name: string) => Package;
  logs: ReturnType<typeof logServiceBuilder>;
  environment?: (name: string) => Promise<NodeJS.ProcessEnv>;
  watchSource?: (path: string, changed: () => void) => () => void;
  isShuttingDown: () => boolean;
  onSourceChange: (name: string) => void;
};

type ApplicationService = {
  has: (name: string) => boolean;
  startPackage: (name: string) => Promise<void>;
  stop: (name: string) => Promise<boolean>;
  stopAll: () => Promise<void>;
};

function packageReadinessUrl(item: Package): string {
  const endpoint = new URL(LOCAL_ENDPOINTS.backendForFrontend);
  const path =
    item.name === PACKAGE_NAMES.backendForFrontend
      ? PACKAGE_READINESS_PATHS.backendForFrontend
      : PACKAGE_READINESS_PATHS.default;

  return `${endpoint.protocol}//${endpoint.hostname}:${item.port}${path}`;
}

function applyEffectivePort(
  item: Package,
  environment: NodeJS.ProcessEnv | undefined
): void {
  if (environment?.PORT === undefined) return;
  const port = Number(environment.PORT);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT)
    throw new Error(`Invalid local PORT for ${item.name}: ${environment.PORT}`);
  item.port = port;
}

export function applicationServiceBuilder(
  options: ApplicationServiceOptions
): ApplicationService {
  const { packages, getPackage, logs } = options;
  const children = new Map<string, Child>();
  const watchers = new Map<string, () => void>();
  const stopping = new Set<string>();

  function assertAvailablePorts(names: string[]): void {
    const selected = new Set(names);
    const ports = new Map<number, string>();

    packages
      .filter((item) => children.has(item.name) || selected.has(item.name))
      .forEach((item) => {
        if (!item.port) return;

        const previous = ports.get(item.port);
        if (previous) {
          throw new Error(
            `Local port ${item.port} is shared by ${previous} and ${item.name}; configure distinct local ports`
          );
        }

        ports.set(item.port, item.name);
      });
  }

  async function startPackage(name: string): Promise<void> {
    const item = getPackage(name);
    item.state = "starting";
    delete item.error;
    const cwd = join(options.beRoot, PACKAGE_LAYOUT.directory, item.label);
    try {
      const environment = await options.environment?.(name);
      applyEffectivePort(item, environment);
      assertAvailablePorts([name]);
      await launch(name, {
        source: name,
        executable: join(cwd, PACKAGE_LAYOUT.runner),
        args: ["-r", "dotenv-flow/config", PACKAGE_LAYOUT.runtimeEntrypoint],
        cwd,
        env: environment,
      });
      if (item.port) await waitFor(name, packageReadinessUrl(item));
      if (!children.has(name))
        throw new Error(item.error ?? `Package ${name} exited during startup`);
      item.state = "running";
      if (item.watch && options.watchSource)
        watchers.set(
          name,
          options.watchSource(join(cwd, PACKAGE_LAYOUT.source), () => {
            if (
              !options.isShuttingDown() &&
              !stopping.has(name) &&
              item.state === "running" &&
              children.has(name)
            )
              options.onSourceChange(name);
          })
        );
    } catch (error) {
      item.state = "failed";
      item.error = errorMessage(error);
      await stopChild(name);
      delete item.pid;
      throw error;
    }
  }

  async function waitFor(name: string, url: string): Promise<void> {
    const deadline = Date.now() + DASHBOARD_TIMING.readinessTimeoutMs;
    while (Date.now() < deadline) {
      if (!children.has(name))
        throw new Error(`${name} exited before becoming ready`);
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(
            DASHBOARD_TIMING.readinessRequestTimeoutMs
          ),
        });
        if (response.ok) return;
      } catch {
        /* Readiness may lag behind process startup. */
      }
      await delay(DASHBOARD_TIMING.readinessIntervalMs); // NOSONAR: each retry must wait, then recheck the child and readiness.
    }
    throw new Error(`${name} readiness timed out at ${url}`);
  }

  async function launch(name: string, command: Command): Promise<void> {
    let exited: string | undefined;
    const child = await options.driver.start(
      command,
      (line) => logs.append(command.source, line),
      (error) => {
        exited = error;
        watchers.get(name)?.();
        watchers.delete(name);
        children.delete(name);
        const item = packages.find((p) => p.name === name);
        if (item) {
          item.state = "failed";
          item.error = error;
          delete item.pid;
        }
        logs.append(command.source, `ERROR ${error}`);
      }
    );
    if (exited) {
      await child.stop();
      throw new Error(exited);
    }
    children.set(name, child);
    const item = packages.find((p) => p.name === name);
    if (item) item.pid = child.pid;
  }

  async function stopChild(name: string): Promise<void> {
    stopping.add(name);
    try {
      const child = children.get(name);
      if (child) {
        await child.stop();
        children.delete(name);
      }
      watchers.get(name)?.();
      watchers.delete(name);
    } finally {
      stopping.delete(name);
    }
  }

  async function stop(name: string): Promise<boolean> {
    const running = children.has(name);
    await stopChild(name);
    const item = packages.find((p) => p.name === name);
    if (item) {
      item.state = "stopped";
      delete item.pid;
      delete item.error;
    }
    return running;
  }

  async function stopAll(): Promise<void> {
    const names = new Set([
      ...packages.map((item) => item.name),
      ...children.keys(),
    ]);

    for (const name of names) {
      await stop(name); // NOSONAR: a failed stop must abort before stopping later packages.
    }
  }

  return {
    has: (name: string): boolean => children.has(name),
    startPackage,
    stop,
    stopAll,
  };
}
