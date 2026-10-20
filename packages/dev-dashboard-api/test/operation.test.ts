import type { DashboardAction } from "pagopa-interop-dev-dashboard-contracts";

import { describe, expect, it, vi } from "vitest";

import type { OperationStep } from "../src/model/domain/operation.js";

import { logServiceBuilder } from "../src/services/logService.js";
import { operationServiceBuilder } from "../src/services/operationService.js";

function deferred() {
  let resolve: (value: boolean) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<boolean>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setup() {
  const onPhaseSkipped = vi.fn();
  const onPhaseFailed = vi.fn();
  const service = operationServiceBuilder({
    logs: logServiceBuilder(),
    isShuttingDown: () => false,
    onPhaseSkipped,
    onPhaseFailed,
  });
  return { service, onPhaseSkipped, onPhaseFailed };
}

function startSteps(count: number) {
  const gates = Array.from({ length: count }, deferred);
  const steps = gates.map((gate, index) => ({
    id: `start:${index}`,
    label: `Start ${index}`,
    concurrent: true,
    run: vi.fn(() => gate.promise),
  }));
  return { gates, steps };
}

describe("operation start scheduling", () => {
  it("limits concurrent starts to four and waits for every start before seed or the next operation", async () => {
    const { service } = setup();
    const { gates, steps } = startSteps(6);
    const build = deferred();
    const seed = deferred();
    const seedRun = vi.fn(() => seed.promise);
    const nextRun = vi.fn(async () => true);
    const action = {
      type: "preset.start",
      id: "all",
    } satisfies DashboardAction;
    const plan = (): OperationStep[] => [
      { id: "build", label: "Build", run: () => build.promise },
      ...steps,
      { id: "seed", label: "Seed", run: seedRun },
    ];
    const accepted = service.enqueue(action, plan);
    service.enqueue({ type: "infra.start" }, () => [
      { id: "infra:start", label: "Infra", run: nextRun },
    ]);

    try {
      await vi.waitFor(() =>
        expect(service.list()[0].phases[0].state).toBe("running")
      );
      expect(steps.every((step) => step.run.mock.calls.length === 0)).toBe(
        true
      );
      build.resolve(true);
      await vi.waitFor(() =>
        expect(steps.map((step) => step.run.mock.calls.length)).toEqual([
          1, 1, 1, 1, 0, 0,
        ])
      );
      expect(service.enqueue(action, plan)).toEqual(accepted);
      expect(seedRun).not.toHaveBeenCalled();
      expect(nextRun).not.toHaveBeenCalled();

      gates[1].resolve(true);
      await vi.waitFor(() => expect(steps[4].run).toHaveBeenCalledOnce());
      expect(steps[5].run).not.toHaveBeenCalled();
      gates[4].resolve(true);
      await vi.waitFor(() => expect(steps[5].run).toHaveBeenCalledOnce());
      expect(seedRun).not.toHaveBeenCalled();
      gates[0].resolve(true);
      gates[2].resolve(true);
      gates[3].resolve(true);
      expect(nextRun).not.toHaveBeenCalled();
      expect(service.list()[0]).not.toHaveProperty("finishedAt");
      gates[5].resolve(true);
      await vi.waitFor(() => expect(seedRun).toHaveBeenCalledOnce());
      expect(nextRun).not.toHaveBeenCalled();
      expect(service.list()[1].state).toBe("pending");
    } finally {
      build.resolve(true);
      gates.forEach((gate) => gate.resolve(true));
      seed.resolve(true);
      await service.idle();
    }

    expect(nextRun).toHaveBeenCalledOnce();
    expect(service.list().map((operation) => operation.state)).toEqual([
      "passed",
      "passed",
    ]);
  });

  it("stops scheduling a failed preset but settles launched starts before releasing the queue", async () => {
    const { service, onPhaseSkipped } = setup();
    const { gates, steps } = startSteps(6);
    const futureRun = vi.fn(async () => true);
    const nextRun = vi.fn(async () => true);
    const action = {
      type: "preset.start",
      id: "all",
    } satisfies DashboardAction;
    const accepted = service.enqueue(action, () => [
      ...steps,
      { id: "seed", label: "Seed", run: futureRun },
    ]);
    service.enqueue({ type: "infra.start" }, () => [
      { id: "infra:start", label: "Infra", run: nextRun },
    ]);

    try {
      await vi.waitFor(() => expect(steps[3].run).toHaveBeenCalledOnce());
      gates[0].reject(new Error("First start failed"));
      await vi.waitFor(() =>
        expect(service.list()[0].phases[0].state).toBe("failed")
      );
      expect(service.enqueue(action, () => steps)).toEqual(accepted);
      expect(service.list()[0].state).toBe("running");
      expect(service.list()[0]).not.toHaveProperty("finishedAt");
      expect(steps[4].run).not.toHaveBeenCalled();
      expect(steps[5].run).not.toHaveBeenCalled();
      expect(futureRun).not.toHaveBeenCalled();
      expect(nextRun).not.toHaveBeenCalled();
      gates[2].reject(new Error("Another start failed"));
    } finally {
      gates.forEach((gate) => gate.resolve(true));
      await service.idle();
    }

    expect(service.list()[0]).toMatchObject({
      state: "failed",
      error: "First start failed; Another start failed",
      phases: [
        { state: "failed" },
        { state: "passed" },
        { state: "failed" },
        { state: "passed" },
        { state: "skipped" },
        { state: "skipped" },
        { state: "skipped" },
      ],
    });
    expect(onPhaseSkipped.mock.calls.map(([phase]) => phase.id)).toEqual([
      "start:4",
      "start:5",
      "seed",
    ]);
    expect(nextRun).toHaveBeenCalledOnce();
  });

  it("continues scheduling a bulk start after an individual start fails", async () => {
    const { service } = setup();
    const { gates, steps } = startSteps(5);
    service.enqueue(
      { type: "packages.start", names: ["0", "1", "2", "3", "4"] },
      () => steps
    );

    try {
      await vi.waitFor(() => expect(steps[3].run).toHaveBeenCalledOnce());
      gates[0].reject(new Error("Expected start failure"));
      await vi.waitFor(() => expect(steps[4].run).toHaveBeenCalledOnce());
    } finally {
      gates.forEach((gate) => gate.resolve(true));
      await service.idle();
    }

    expect(service.list()[0]).toMatchObject({
      state: "failed",
      phases: [
        { state: "failed" },
        { state: "passed" },
        { state: "passed" },
        { state: "passed" },
        { state: "passed" },
      ],
    });
  });

  it("keeps unmarked phases sequential between concurrent start groups", async () => {
    const { service } = setup();
    const { gates, steps } = startSteps(2);
    const stop = deferred();
    const watch = deferred();
    const stopRun = vi.fn(() => stop.promise);
    const watchRun = vi.fn(() => watch.promise);
    const finalRun = vi.fn(async () => true);
    service.enqueue({ type: "preset.start", id: "all" }, () => [
      ...steps,
      { id: "stop:one", label: "Stop", run: stopRun },
      { id: "watch:one", label: "Watch", run: watchRun },
      { id: "start:last", label: "Last", concurrent: true, run: finalRun },
    ]);

    try {
      await vi.waitFor(() => expect(steps[1].run).toHaveBeenCalledOnce());
      expect(stopRun).not.toHaveBeenCalled();
      gates.forEach((gate) => gate.resolve(true));
      await vi.waitFor(() => expect(stopRun).toHaveBeenCalledOnce());
      expect(watchRun).not.toHaveBeenCalled();
      expect(finalRun).not.toHaveBeenCalled();
      stop.resolve(true);
      await vi.waitFor(() => expect(watchRun).toHaveBeenCalledOnce());
      expect(finalRun).not.toHaveBeenCalled();
    } finally {
      gates.forEach((gate) => gate.resolve(true));
      stop.resolve(true);
      watch.resolve(true);
      await service.idle();
    }

    expect(finalRun).toHaveBeenCalledOnce();
  });
});
