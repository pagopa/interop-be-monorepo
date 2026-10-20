import { join } from "node:path";
import {
  DashboardAction,
  type DashboardStatus,
  type OperationAccepted,
  type Package,
  type Phase,
  type Preset,
  type PresetMember,
} from "pagopa-interop-dev-dashboard-contracts";

import type { Command, Driver } from "../model/domain/models.js";
import type { OperationStep } from "../model/domain/operation.js";

import {
  DASHBOARD_ACTION_TYPES,
  DASHBOARD_PATHS,
  DASHBOARD_TIMING,
  LOCAL_ENDPOINTS,
  LOG_SOURCES,
  LOG_SOURCE_PREFIXES,
  OPERATION_PHASE_IDS,
  SEED_PACKAGES,
  WORKSPACE_BUILD_CONCURRENCY,
} from "../config/constants.js";
import { errorMessage } from "../utilities/errorUtils.js";
import { applicationServiceBuilder } from "./applicationService.js";
import { logServiceBuilder } from "./logService.js";
import { operationServiceBuilder } from "./operationService.js";
import { presetServiceBuilder } from "./presetService.js";
import { persistWatchPreferences } from "./watchPreferenceService.js";

type SupervisorOptions = {
  beRoot: string;
  driver: Driver;
  packages: Package[];
  presets: Preset[];
  personalPath?: string;
  watchPath?: string;
  watchPreferences?: Record<string, boolean>;
  environment?: (name: string) => Promise<NodeJS.ProcessEnv>;
  seedReady?: () => Promise<boolean>;
  watchSource?: (path: string, changed: () => void) => () => void;
};

export type Supervisor = {
  readonly logs: ReturnType<typeof logServiceBuilder>;
  status: () => DashboardStatus;
  setInfrastructure: (value: DashboardStatus["infrastructure"]) => void;
  refreshSeed: () => Promise<void>;
  idle: () => Promise<void>;
  action: (input: unknown) => OperationAccepted;
  autostart: (presetId?: string) => OperationAccepted;
  shutdown: () => Promise<void>;
  savePreset: (input: unknown) => Promise<Preset>;
  deletePreset: (id: string) => Promise<void>;
};

export function supervisorServiceBuilder(
  options: SupervisorOptions
): Supervisor {
  const logs = logServiceBuilder();
  let watchPreferences = { ...options.watchPreferences };
  let watchWrites: Promise<void> = Promise.resolve();
  const watchPath =
    options.watchPath ?? join(options.beRoot, DASHBOARD_PATHS.watchPreferences);
  const packages: Package[] = options.packages.map((item) => ({
    ...item,
    watch: watchPreferences[item.name] ?? true,
  }));
  let infrastructure: DashboardStatus["infrastructure"] = [];
  let seeded = false;
  let shuttingDown = false;

  const applications = applicationServiceBuilder({
    beRoot: options.beRoot,
    driver: options.driver,
    packages,
    getPackage,
    logs,
    environment: options.environment,
    watchSource: options.watchSource,
    isShuttingDown: (): boolean => shuttingDown,
    onSourceChange: restartWatchedPackage,
  });
  const presetStore = presetServiceBuilder({
    beRoot: options.beRoot,
    personalPath: options.personalPath,
    presets: options.presets,
    getPackage,
  });
  const operationsService = operationServiceBuilder({
    logs,
    isShuttingDown: (): boolean => shuttingDown,
    onPhaseFailed,
    onPhaseSkipped,
  });

  function onPhaseFailed(phase: Phase): void {
    const name = phase.id.replace(/^(start|stop|watch):/, "");
    const item = packages.find((entry) => entry.name === name);
    if (item) {
      item.error = phase.error;
      if (phase.id.startsWith("start:") && !applications.has(name))
        item.state = "failed";
    }
  }

  function onPhaseSkipped(phase: Phase): void {
    if (!phase.id.startsWith("start:")) return;

    const name = phase.id.slice("start:".length);
    const item = getPackage(name);
    if (item.state === "building" && !applications.has(name)) {
      item.state = "stopped";
    }
  }

  function status(): DashboardStatus {
    return structuredClone({
      packages,
      presets: presetStore.list(),
      infrastructure,
      operations: operationsService.list(),
      seedReady: seeded,
      seedPackages: [...SEED_PACKAGES],
      seedPrerequisites: seedPrerequisites(),
      logSources: [
        {
          id: LOG_SOURCES.orchestration,
          label: "Orchestration",
          kind: "orchestration",
        },
        ...packages.map<DashboardStatus["logSources"][number]>((p) => ({
          id: p.name,
          label: p.label,
          kind: "backend",
        })),
        ...infrastructure.map<DashboardStatus["logSources"][number]>((p) => ({
          id: `${LOG_SOURCE_PREFIXES.infrastructure}${p.name}`,
          label: p.name,
          kind: "infrastructure",
        })),
      ] satisfies DashboardStatus["logSources"],
    });
  }

  function setInfrastructure(value: DashboardStatus["infrastructure"]): void {
    infrastructure = value;
  }

  async function refreshSeed(): Promise<void> {
    seeded = (await options.seedReady?.()) ?? false;
  }

  function idle(): Promise<void> {
    return operationsService.idle();
  }

  function getPackage(name: string): Package {
    const item = packages.find((p) => p.name === name);
    if (!item) throw new Error(`Unknown package: ${name}`);
    return item;
  }

  function action(input: unknown): OperationAccepted {
    if (shuttingDown) throw new Error("Dashboard is shutting down");

    const action = DashboardAction.parse(input);

    return operationsService.enqueue(action, () => actionSteps(action));
  }

  function restartWatchedPackage(name: string): void {
    const item = getPackage(name);
    const pid = item.pid;
    const restartAction: DashboardAction = {
      type: DASHBOARD_ACTION_TYPES.packageRestart,
      name,
    };
    let shouldRestart: boolean | undefined;

    operationsService.enqueue(
      restartAction,
      () =>
        actionSteps(restartAction).map((step) => ({
          ...step,
          run: async () => {
            shouldRestart ??=
              item.watch &&
              item.state === "running" &&
              applications.has(name) &&
              item.pid === pid;
            return shouldRestart ? step.run() : false;
          },
        })),
      `watch:${JSON.stringify(restartAction)}`
    );
  }

  function autostart(presetId?: string): OperationAccepted {
    const action: DashboardAction =
      presetId === undefined
        ? { type: DASHBOARD_ACTION_TYPES.infraStart }
        : { type: DASHBOARD_ACTION_TYPES.presetStart, id: presetId };

    return operationsService.enqueue(action, () => [
      ...infraStart(),
      ...(presetId === undefined ? [] : presetStart(presetStore.get(presetId))),
    ]);
  }

  function actionSteps(action: DashboardAction): OperationStep[] {
    let steps: OperationStep[];
    switch (action.type) {
      case DASHBOARD_ACTION_TYPES.packagesStart:
        steps = startSteps(
          [...new Set(action.names)].map((name) => ({ name }))
        );
        break;
      case DASHBOARD_ACTION_TYPES.packagesStop:
        steps = [...new Set(action.names)].map((name) => {
          getPackage(name);
          return stopStep(name);
        });
        break;
      case DASHBOARD_ACTION_TYPES.packagesWatch:
        steps = [...new Set(action.names)].map((name) => {
          getPackage(name);
          return watchStep(name, action.watch);
        });
        break;
      case DASHBOARD_ACTION_TYPES.packageStart:
        steps = startSteps([{ name: getPackage(action.name).name }]);
        break;
      case DASHBOARD_ACTION_TYPES.packageStop:
        getPackage(action.name);
        steps = [stopStep(action.name)];
        break;
      case DASHBOARD_ACTION_TYPES.packageRestart:
        getPackage(action.name);
        steps = [stopStep(action.name), ...startSteps([{ name: action.name }])];
        break;
      case DASHBOARD_ACTION_TYPES.packageWatch: {
        getPackage(action.name);
        steps = [watchStep(action.name, action.watch)];
        break;
      }
      case DASHBOARD_ACTION_TYPES.presetStart: {
        const preset = presetStore.get(action.id);
        steps = presetStart(preset);
        break;
      }
      case DASHBOARD_ACTION_TYPES.presetStop: {
        const preset = presetStore.get(action.id);
        steps = preset.packages.map((p) => stopStep(p.name));
        break;
      }
      case DASHBOARD_ACTION_TYPES.infraStart:
        steps = infraStart();
        break;
      case DASHBOARD_ACTION_TYPES.infraStop:
        steps = [stopAllStep(), infraStep("stop")];
        break;
      case DASHBOARD_ACTION_TYPES.infraReset:
        steps = [stopAllStep(), infraStep("reset"), ...infraStart()];
        break;
      case DASHBOARD_ACTION_TYPES.seed:
        steps = [seedStep()];
        break;
      case DASHBOARD_ACTION_TYPES.seedPrepare:
        steps = startSteps(SEED_PACKAGES.map((name) => ({ name })));
        break;
    }
    return steps;
  }

  async function run(command: Command): Promise<string> {
    return options.driver.run(command, (line) =>
      logs.append(command.source, line)
    );
  }

  function infraStep(
    phase:
      | "recover"
      | "start"
      | "wait"
      | "topics"
      | "connector"
      | "stop"
      | "reset"
  ): OperationStep {
    return {
      id: `infra:${phase}`,
      label: `Infrastructure ${phase}`,
      run: async () => {
        await run({
          source: LOG_SOURCES.orchestration,
          executable: "bash",
          args: [join(options.beRoot, DASHBOARD_PATHS.infraScript), phase],
          cwd: options.beRoot,
          timeoutMs: DASHBOARD_TIMING.infraCommandTimeoutMs,
        });
        if (phase === "reset") {
          seeded = false;
          logs
            .sources()
            .filter((source) =>
              source.startsWith(LOG_SOURCE_PREFIXES.infrastructure)
            )
            .forEach(logs.reset);
        }
        return true;
      },
    };
  }

  function infraStart(): OperationStep[] {
    return (
      ["recover", "start", "wait", "topics", "connector"] satisfies Array<
        "recover" | "start" | "wait" | "topics" | "connector"
      >
    ).map((phase) => infraStep(phase));
  }

  function startSteps(members: PresetMember[]): OperationStep[] {
    members.forEach((member) => {
      getPackage(member.name);
    });
    return [
      {
        id: OPERATION_PHASE_IDS.build,
        label: "Build workspace dependencies",
        run: async () => {
          const pending = members.filter((m) => !applications.has(m.name));
          if (!pending.length) return false;
          pending.forEach((m) => {
            const p = getPackage(m.name);
            p.state = "building";
            delete p.error;
          });
          try {
            await run({
              source: LOG_SOURCES.orchestration,
              executable: "pnpm",
              args: [
                "exec",
                "turbo",
                "run",
                "build",
                ...pending.map((m) => `--filter=${m.name}^...`),
                `--concurrency=${WORKSPACE_BUILD_CONCURRENCY}`,
              ],
              cwd: options.beRoot,
              timeoutMs: DASHBOARD_TIMING.workspaceBuildTimeoutMs,
            });
          } catch (error) {
            pending.forEach((m) => {
              const p = getPackage(m.name);
              p.state = "failed";
              p.error = errorMessage(error);
            });
            throw error;
          }
          return true;
        },
      },
      ...members.map((member) => ({
        id: `start:${member.name}`,
        label: `Start ${member.name}`,
        concurrent: true,
        run: async () => {
          if (applications.has(member.name)) return false;
          if (
            member.watch !== undefined &&
            getPackage(member.name).watch !== member.watch
          )
            await setWatchPreference(member.name, member.watch);
          await applications.startPackage(member.name);
          return true;
        },
      })),
    ];
  }

  function presetStart(preset: Preset): OperationStep[] {
    return startSteps(preset.packages);
  }

  function seedStep(): OperationStep {
    return {
      id: "seed",
      label: "Seed local dataset",
      run: async () => {
        const missing = seedPrerequisites();
        if (missing.length)
          throw new Error(
            `Seed requires running packages: ${missing.join(", ")}`
          );
        await run({
          source: LOG_SOURCES.orchestration,
          executable: "node",
          args: [join(options.beRoot, DASHBOARD_PATHS.localCli), "seed"],
          cwd: options.beRoot,
          timeoutMs: DASHBOARD_TIMING.infraCommandTimeoutMs,
          env: {
            LOCAL_KMS_ENDPOINT: LOCAL_ENDPOINTS.localstack,
            TENANT_PROCESS_URL: LOCAL_ENDPOINTS.tenantProcess,
            CATALOG_PROCESS_URL: LOCAL_ENDPOINTS.catalogProcess,
          },
        });
        await refreshSeed();
        return true;
      },
    };
  }

  function seedPrerequisites(): string[] {
    return SEED_PACKAGES.filter(
      (name) => packages.find((item) => item.name === name)?.state !== "running"
    );
  }

  function stopStep(name: string): OperationStep {
    return {
      id: `stop:${name}`,
      label: `Stop ${name}`,
      run: () => applications.stop(name),
    };
  }

  function watchStep(name: string, watch: boolean): OperationStep {
    return {
      id: `watch:${name}`,
      label: `Set watch for ${name}`,
      run: async () => {
        const item = getPackage(name);
        const running = applications.has(name);
        const changed = item.watch !== watch;
        if (!changed) return false;

        if (running) await applications.stop(name);
        await setWatchPreference(name, watch);
        if (running) await applications.startPackage(name);
        return true;
      },
    };
  }

  function setWatchPreference(name: string, watch: boolean): Promise<void> {
    const result = watchWrites.then(async () => {
      const next = { ...watchPreferences, [name]: watch };
      await persistWatchPreferences(watchPath, next);
      watchPreferences = next;
      getPackage(name).watch = watch;
    });
    watchWrites = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  function stopAllStep(): OperationStep {
    return {
      id: "stop:applications",
      label: "Stop all managed applications",
      run: async (): Promise<boolean> => {
        await applications.stopAll();
        return true;
      },
    };
  }

  async function shutdown(): Promise<void> {
    shuttingDown = true;
    await operationsService.idle();
    await applications.stopAll();
  }

  return {
    get logs(): ReturnType<typeof logServiceBuilder> {
      return logs;
    },
    status,
    setInfrastructure,
    refreshSeed,
    idle,
    action,
    autostart,
    shutdown,
    savePreset: presetStore.save,
    deletePreset: presetStore.delete,
  };
}
