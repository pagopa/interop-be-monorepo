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
    planSteps: () => OperationStep[]
  ) => OperationAccepted;
  idle: () => Promise<void>;
  list: () => Operation[];
};

function shouldAbort(action: DashboardAction, phase: Phase): boolean {
  const bulkAction =
    action.type === DASHBOARD_ACTION_TYPES.packagesStart ||
    action.type === DASHBOARD_ACTION_TYPES.packagesStop ||
    action.type === DASHBOARD_ACTION_TYPES.packagesWatch;

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

  async function runPhases(
    operation: Operation,
    action: DashboardAction,
    steps: OperationStep[]
  ): Promise<void> {
    for (const [index, step] of steps.entries()) {
      const phase = operation.phases[index];
      await runPhase(operation, phase, step);

      if (phase.state === "failed" && shouldAbort(action, phase)) {
        operation.state = "failed";
        skipPhases(operation.phases.slice(index + 1));
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
    planSteps: () => OperationStep[]
  ): OperationAccepted {
    if (options.isShuttingDown()) {
      throw new Error("Dashboard is shutting down");
    }

    const key = JSON.stringify(action);
    const existingOperation = inFlight.get(key);

    if (existingOperation) {
      return { operationId: existingOperation };
    }

    const steps = planSteps();
    const operation: Operation = {
      id: randomUUID(),
      kind: action.type,
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
