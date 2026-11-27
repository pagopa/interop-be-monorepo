import type {
  DashboardAction,
  Operation,
  OperationAccepted,
  Phase,
} from "pagopa-interop-dev-dashboard-contracts";

import { randomUUID } from "node:crypto";

import type { OperationStep } from "../model/domain/operation.js";
import type { logServiceBuilder } from "./logService.js";

import {
  APPLICATION_START_CONCURRENCY,
  DASHBOARD_ACTION_TYPES,
  LOG_SOURCES,
  OPERATION_PHASE_IDS,
  PROCESS_LIMITS,
} from "../config/constants.js";
import { errorMessage } from "../utilities/errorUtils.js";

type OperationServiceOptions = {
  logs: ReturnType<typeof logServiceBuilder>;
  isShuttingDown: () => boolean;
  onPhaseFailed: (phase: Phase) => void;
  onPhaseSkipped: (phase: Phase) => void;
};

type OperationService = {
  enqueue: (
    action: DashboardAction,
    planSteps: () => OperationStep[],
    key?: string
  ) => OperationAccepted;
  idle: () => Promise<void>;
  list: () => Operation[];
};

function shouldAbort(action: DashboardAction, phase: Phase): boolean {
  const bulkAction =
    action.type === DASHBOARD_ACTION_TYPES.packagesStart ||
    action.type === DASHBOARD_ACTION_TYPES.packagesStop ||
    action.type === DASHBOARD_ACTION_TYPES.packagesWatch ||
    action.type === DASHBOARD_ACTION_TYPES.presetStop;

  return !bulkAction || phase.id === OPERATION_PHASE_IDS.build;
}

export function operationServiceBuilder(
  options: OperationServiceOptions
): OperationService {
  const operations: Operation[] = [];
  const inFlight = new Map<string, string>();
  let queue: Promise<void> = Promise.resolve();

  function recordFailure(
    operation: Operation,
    phase: Phase,
    error: unknown
  ): void {
    phase.state = "failed";
    phase.error = errorMessage(error);
    operation.error = operation.error
      ? `${operation.error}; ${phase.error}`
      : phase.error;
    options.onPhaseFailed(phase);
    options.logs.append(
      LOG_SOURCES.orchestration,
      `ERROR ${phase.label}: ${phase.error}`
    );
  }

  async function runPhase(
    operation: Operation,
    phase: Phase,
    step: OperationStep
  ): Promise<void> {
    phase.state = "running";
    options.logs.append(LOG_SOURCES.orchestration, `INFO ${phase.label}`);

    try {
      phase.state = (await step.run()) === false ? "skipped" : "passed";
    } catch (error) {
      recordFailure(operation, phase, error);
    }
  }

  function skipPhases(phases: Phase[]): void {
    phases.forEach((phase) => {
      phase.state = "skipped";
      options.onPhaseSkipped(phase);
    });
  }

  function hasAbortingFailure(
    operation: Operation,
    action: DashboardAction
  ): boolean {
    return operation.phases.some(
      (phase) => phase.state === "failed" && shouldAbort(action, phase)
    );
  }

  async function runConcurrentPhases(
    operation: Operation,
    action: DashboardAction,
    steps: OperationStep[],
    first: number,
    end: number
  ): Promise<number> {
    let next = first;
    const worker = async (): Promise<void> => {
      while (next < end && !hasAbortingFailure(operation, action)) {
        const index = next++;
        await runPhase(operation, operation.phases[index], steps[index]);
      }
    };
    const results = await Promise.allSettled(
      Array.from(
        { length: Math.min(APPLICATION_START_CONCURRENCY, end - first) },
        worker
      )
    );
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
    return next;
  }

  async function runPhases(
    operation: Operation,
    action: DashboardAction,
    steps: OperationStep[]
  ): Promise<void> {
    let index = 0;
    while (index < steps.length) {
      if (steps[index].concurrent) {
        let end = index + 1;
        while (end < steps.length && steps[end].concurrent) end++;
        index = await runConcurrentPhases(operation, action, steps, index, end);
      } else {
        await runPhase(operation, operation.phases[index], steps[index]);
        index++;
      }

      if (hasAbortingFailure(operation, action)) {
        operation.state = "failed";
        skipPhases(operation.phases.slice(index));
        return;
      }
    }

    operation.state = operation.phases.some((phase) => phase.state === "failed")
      ? "failed"
      : "passed";
  }

  async function runOperation(
    operation: Operation,
    action: DashboardAction,
    steps: OperationStep[]
  ): Promise<void> {
    operation.state = "running";
    await runPhases(operation, action, steps);
    operation.finishedAt = new Date().toISOString();
  }

  function trimHistory(): void {
    if (operations.length <= PROCESS_LIMITS.operationHistory) {
      return;
    }

    const index = operations.findIndex(
      (operation) =>
        operation.state === "passed" || operation.state === "failed"
    );

    if (index >= 0) {
      operations.splice(index, 1);
    }
  }

  function enqueue(
    action: DashboardAction,
    planSteps: () => OperationStep[],
    key = JSON.stringify(action)
  ): OperationAccepted {
    if (options.isShuttingDown()) {
      throw new Error("Dashboard is shutting down");
    }

    const existingOperation = inFlight.get(key);

    if (existingOperation) {
      return { operationId: existingOperation };
    }

    const steps = planSteps();
    const operation: Operation = {
      id: randomUUID(),
      kind: action.type,
      ...(action.type === DASHBOARD_ACTION_TYPES.presetStart ||
      action.type === DASHBOARD_ACTION_TYPES.presetStop
        ? { presetId: action.id }
        : {}),
      ...(action.type === DASHBOARD_ACTION_TYPES.packageWatch ||
      action.type === DASHBOARD_ACTION_TYPES.packagesWatch
        ? { watch: action.watch }
        : {}),
      state: "pending",
      startedAt: new Date().toISOString(),
      phases: steps.map((step) => ({
        id: step.id,
        label: step.label,
        state: "pending",
      })),
    };

    operations.push(operation);
    inFlight.set(key, operation.id);
    trimHistory();

    queue = queue
      .then(() => runOperation(operation, action, steps))
      .catch((error: unknown) => {
        operation.state = "failed";
        operation.error = errorMessage(error);
      })
      .finally(() => {
        inFlight.delete(key);
      });

    return { operationId: operation.id };
  }

  return {
    enqueue,
    idle: (): Promise<void> => queue,
    list: (): Operation[] => operations,
  };
}
