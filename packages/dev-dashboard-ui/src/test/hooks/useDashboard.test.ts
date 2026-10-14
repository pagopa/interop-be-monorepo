import {
  act,
  renderHook as renderHookWithoutProviders,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  DashboardAction,
  Operation,
  Phase,
} from "../../api/dashboard/dashboard.services";

import { useDashboard } from "../../hooks/useDashboard";
import { statusFixture } from "../fixtures";
import { createTestWrapper } from "../utils";

function renderHook<T>(hook: () => T) {
  return renderHookWithoutProviders(hook, { wrapper: createTestWrapper() });
}

describe("shared runtime state", () => {
  it.each([
    {
      action: { type: "infra.start" },
      key: "infra-start",
      error: " Docker startup failed ",
      phaseError: "Phase failed",
      message: "Docker startup failed",
    },
    {
      action: { type: "infra.stop" },
      key: "infra-stop",
      error: " ",
      phaseError: " Docker shutdown failed ",
      message: "Docker shutdown failed",
    },
    {
      action: { type: "infra.reset", confirm: true },
      key: "infra-reset",
      error: undefined,
      phaseError: undefined,
      message: "No failure details were provided.",
    },
  ] satisfies Array<{
    action: DashboardAction;
    key: string;
    error: string | undefined;
    phaseError: string | undefined;
    message: string;
  }>)(
    "retains the correlated $key failure after acceptance, running and operation eviction",
    async ({ action, key, error, phaseError, message }) => {
      const operation = {
        id: "infra-operation",
        kind: action.type,
        state: "pending",
        startedAt: "2026-10-08T12:00:00Z",
        phases: [],
      } satisfies Operation;
      let currentStatus = statusFixture({
        operations: [{ ...operation, id: "historical", state: "failed" }],
      });
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockImplementation(async (input) => {
          if (!String(input).endsWith("/actions"))
            return Response.json(currentStatus);
          currentStatus = {
            ...currentStatus,
            operations: [...currentStatus.operations, operation],
          };
          return Response.json({ operationId: operation.id }, { status: 202 });
        })
      );
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBeDefined());
      expect(result.current.actionFailures).toEqual({});
      await act(() => result.current.runAction(action, ["infra", key]));
      expect(result.current.busy).toEqual({
        infra: operation.id,
        [key]: operation.id,
      });
      expect(result.current.actionFailures).toEqual({});
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((item) =>
          item.id === operation.id ? { ...item, state: "running" } : item
        ),
      };
      await act(() => result.current.refresh());
      await waitFor(() =>
        expect(
          result.current.status?.operations.find(
            (item) => item.id === operation.id
          )?.state
        ).toBe("running")
      );
      expect(result.current.busy.infra).toBe(operation.id);
      expect(result.current.actionFailures).toEqual({});
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((item) =>
          item.id === operation.id
            ? {
                ...item,
                state: "failed",
                error,
                phases: [
                  {
                    id: "docker",
                    label: "Docker",
                    state: "failed",
                    error: phaseError,
                  },
                ],
              }
            : item
        ),
      };
      await act(() => result.current.refresh());
      await waitFor(() => expect(result.current.busy).toEqual({}));
      const failure = {
        kind: action.type,
        operationId: operation.id,
        message,
      };
      expect(result.current.actionFailures).toEqual({ infra: failure });
      expect(result.current.actionError).toBe("");
      currentStatus = { ...currentStatus, operations: [] };
      await act(() => result.current.refresh());
      await waitFor(() =>
        expect(result.current.status?.operations).toEqual([])
      );
      expect(result.current.busy).toEqual({});
      expect(result.current.actionFailures).toEqual({ infra: failure });
    }
  );

  it.each([
    { scope: "single", outcome: "passed" },
    { scope: "single", outcome: "failed" },
    { scope: "bulk", outcome: "passed" },
    { scope: "bulk", outcome: "failed" },
  ] satisfies Array<{
    scope: "single" | "bulk";
    outcome: "passed" | "failed";
  }>)(
    "keeps $scope Watch pending separately through POST and accepted operation until $outcome and rejects conflicts",
    async ({ scope, outcome }) => {
      const fixture = statusFixture({ operations: [] });
      const names = fixture.packages
        .slice(0, scope === "single" ? 1 : 2)
        .map((item) => item.name);
      const watchKeys = names.map((name) => `package-watch:${name}`);
      let currentStatus = fixture;
      let finish: (response: Response) => void = () => undefined;
      const acceptance = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      let posts = 0;
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(async (input) => {
          if (!String(input).endsWith("/actions"))
            return Response.json(currentStatus);
          posts += 1;
          return posts === 1
            ? acceptance
            : Response.json(
                { error: "Unexpected duplicate submission" },
                { status: 409 }
              );
        });
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBeDefined());
      const action: DashboardAction =
        scope === "single"
          ? { type: "package.watch", name: names[0], watch: true }
          : { type: "packages.watch", names, watch: true };
      let submitted: Promise<boolean> | undefined;
      act(() => {
        submitted = result.current.runAction(
          action,
          scope === "single" ? watchKeys[0] : watchKeys
        );
      });
      try {
        expect(result.current.busy).toEqual(
          Object.fromEntries(watchKeys.map((key) => [key, "request"]))
        );
        await act(async () => {
          expect(
            await result.current.runAction(
              { type: "package.start", name: names[0] },
              `package:${names[0]}`
            )
          ).toBe(false);
          expect(
            await result.current.runAction(
              { type: "packages.stop", names },
              names.map((name) => `package:${name}`)
            )
          ).toBe(false);
          expect(await result.current.runAction(action, watchKeys)).toBe(false);
        });
        expect(posts).toBe(1);
      } finally {
        currentStatus = {
          ...fixture,
          operations: [
            {
              id: "watch-operation",
              kind: action.type,
              state: "running",
              startedAt: "2026-10-08T12:00:00Z",
              phases: names.map((name) => ({
                id: `watch:${name}`,
                label: "Watch",
                state: "pending",
              })),
            },
          ],
        };
        await act(async () => {
          finish(
            Response.json({ operationId: "watch-operation" }, { status: 202 })
          );
          await submitted;
        });
      }
      await waitFor(() =>
        expect(result.current.busy).toEqual(
          Object.fromEntries(watchKeys.map((key) => [key, "watch-operation"]))
        )
      );
      await act(async () => {
        expect(
          await result.current.runAction(
            { type: "package.stop", name: names[0] },
            `package:${names[0]}`
          )
        ).toBe(false);
      });
      expect(posts).toBe(1);
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          phases: operation.phases.map((phase) => ({
            ...phase,
            state: "passed",
          })),
        })),
      };
      await act(() => result.current.refresh());
      await waitFor(() =>
        expect(result.current.status?.operations[0]?.phases[0].state).toBe(
          "passed"
        )
      );
      expect(result.current.busy).toEqual(
        Object.fromEntries(watchKeys.map((key) => [key, "watch-operation"]))
      );
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          state: outcome,
        })),
      };
      await act(() => result.current.refresh());
      await waitFor(() => expect(result.current.busy).toEqual({}));
    }
  );
  it("blocks Watch while Start/Stop owns the same package during its POST", async () => {
    let currentStatus = statusFixture({ operations: [] });
    const name = currentStatus.packages[0].name;
    let finish: (response: Response) => void = () => undefined;
    const acceptance = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    let posts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        if (!String(input).endsWith("/actions"))
          return Response.json(currentStatus);
        posts += 1;
        return posts === 1
          ? acceptance
          : Response.json({ error: "Unexpected duplicate" }, { status: 409 });
      })
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBeDefined());
    let submitted: Promise<boolean> | undefined;
    act(() => {
      submitted = result.current.runAction(
        { type: "package.start", name },
        `package:${name}`
      );
    });
    try {
      await act(async () => {
        expect(
          await result.current.runAction(
            { type: "package.watch", name, watch: true },
            `package-watch:${name}`
          )
        ).toBe(false);
      });
      expect(posts).toBe(1);
    } finally {
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            id: "start",
            kind: "package.start",
            state: "passed",
            startedAt: "2026-10-08T12:00:00Z",
            phases: [],
          },
        ],
      };
      await act(async () => {
        finish(Response.json({ operationId: "start" }, { status: 202 }));
        await submitted;
      });
    }
  });
  it("shares one status request between simultaneous dashboard observers", async () => {
    let finish: (response: Response) => void = () => undefined;
    const response = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => ({
      first: useDashboard(),
      second: useDashboard(),
    }));
    try {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      finish(Response.json(statusFixture()));
    }
    await waitFor(() => expect(result.current.first.status).toBeDefined());
    expect(result.current.second.status).toEqual(result.current.first.status);
  });
  it("discovers active seed, seed preparation and infrastructure busy keys after reload", async () => {
    const currentStatus = statusFixture({
      operations: [
        {
          id: "prepare",
          kind: "seed.prepare",
          state: "running",
          startedAt: "2026-10-08T12:00:00Z",
          phases: [],
        },
        {
          id: "infra",
          kind: "infra.start",
          state: "pending",
          startedAt: "2026-10-08T12:00:00Z",
          phases: [],
        },
        {
          id: "seed",
          kind: "seed",
          state: "running",
          startedAt: "2026-10-08T12:00:00Z",
          phases: [],
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(currentStatus))
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBeDefined());
    expect(result.current.busy).toMatchObject({
      "seed-prepare": "prepare",
      "infra-start": "infra",
      infra: "infra",
      seed: "seed",
    });
  });
  it.each([
    {
      kind: "preset.start",
      state: "pending",
      phase: "start",
    },
    {
      kind: "preset.start",
      state: "running",
      phase: "start",
    },
    {
      kind: "preset.stop",
      state: "running",
      phase: "stop",
    },
  ] satisfies Array<{
    kind: Operation["kind"];
    state: Operation["state"];
    phase: string;
  }>)(
    "locks a backend package during a $state $kind phase after reload",
    async ({ kind, state, phase }) => {
      const name = statusFixture().packages[0].name;
      const key = `package:${name}`;
      let currentStatus = statusFixture({
        operations: [
          {
            id: "autostart",
            kind,
            state,
            startedAt: "2026-10-08T12:00:00Z",
            phases: [{ id: `${phase}:${name}`, label: name, state: "pending" }],
          },
        ],
      });
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(currentStatus));
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBeDefined());
      expect(result.current.busy[key]).toBe("autostart");
      expect(result.current.busy.infra).toBeUndefined();
      expect(result.current.busy.seed).toBeUndefined();
      await act(async () => {
        expect(
          await result.current.runAction({ type: "package.start", name }, key)
        ).toBe(false);
      });
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).endsWith("/actions")
        )
      ).toBe(false);
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          state: "passed",
        })),
      };
      await act(() => result.current.refresh());
      await waitFor(() => expect(result.current.busy[key]).toBeUndefined());
    }
  );
  it.each([
    {
      error: " Backend build failed ",
      phaseError: "Process failed",
      message: "Backend build failed",
    },
    {
      error: " ",
      phaseError: " Process failed ",
      message: "Process failed",
    },
    {
      error: undefined,
      phaseError: undefined,
      message: "No failure details were provided.",
    },
  ])(
    "captures an immediately failed accepted preset with detail '$message'",
    async ({ error, phaseError, message }) => {
      let currentStatus = statusFixture({ operations: [] });
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockImplementation(async (input) => {
          if (!String(input).endsWith("/actions"))
            return Response.json(currentStatus);
          currentStatus = {
            ...currentStatus,
            operations: [
              {
                id: "failed-preset",
                kind: "preset.start",
                state: "failed",
                startedAt: "2026-10-08T12:00:00Z",
                error,
                phases: [
                  {
                    id: "build",
                    label: "Build packages",
                    state: "failed",
                    error: phaseError,
                  },
                ],
              },
            ],
          };
          return Response.json(
            { operationId: "failed-preset" },
            { status: 202 }
          );
        })
      );
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBeDefined());
      await act(async () => {
        expect(
          await result.current.runAction(
            { type: "preset.start", id: "backend" },
            ["preset:backend", "preset-start:backend"]
          )
        ).toBe(true);
      });
      expect(result.current.busy).toEqual({});
      expect(result.current.actionFailures).toEqual({
        "preset:backend": {
          kind: "preset.start",
          message,
          operationId: "failed-preset",
        },
      });
      expect(result.current.actionError).toBe("");
    }
  );

  it("does not correlate historical failures or package actions to preset errors", async () => {
    let currentStatus = statusFixture({
      operations: [
        {
          id: "historical-preset",
          kind: "preset.start",
          state: "failed",
          error: "An old failure",
          startedAt: "2026-10-08T12:00:00Z",
          phases: [],
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        if (!String(input).endsWith("/actions"))
          return Response.json(currentStatus);
        currentStatus = {
          ...currentStatus,
          operations: [
            ...currentStatus.operations,
            {
              ...currentStatus.operations[0],
              id: "failed-package",
              kind: "package.start",
              error: "A package failure",
            },
          ],
        };
        return Response.json(
          { operationId: "failed-package" },
          { status: 202 }
        );
      })
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBeDefined());
    expect(result.current.actionFailures).toEqual({});
    const name = currentStatus.packages[0].name;
    await act(() =>
      result.current.runAction(
        { type: "package.start", name },
        `package:${name}`
      )
    );
    expect(result.current.busy).toEqual({});
    expect(result.current.actionFailures).toEqual({});
  });

  it.each(["passed", "skipped", "failed"] satisfies Array<Phase["state"]>)(
    "marks every batch member busy immediately, rejects overlapping submissions and releases a %s row before the batch completes",
    async (phaseState) => {
      const fixture = statusFixture({ operations: [] });
      const names = fixture.packages.slice(0, 2).map((item) => item.name);
      const keys = names.map((name) => `package:${name}`);
      let currentStatus = fixture;
      let finishAction: (response: Response) => void = () => undefined;
      const accepted = new Promise<Response>((resolve) => {
        finishAction = resolve;
      });
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(async (input) =>
          String(input).endsWith("/actions")
            ? accepted
            : Response.json(currentStatus)
        );
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(() => useDashboard());
      await waitFor(() => expect(result.current.status).toBeDefined());
      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.runAction(
          { type: "packages.start", names },
          keys
        );
      });
      expect(result.current.busy).toEqual(
        Object.fromEntries(keys.map((key) => [key, "request"]))
      );
      await act(async () => {
        expect(
          await result.current.runAction(
            { type: "package.start", name: names[0] },
            keys[0]
          )
        ).toBe(false);
        const overlapNames = [fixture.packages[2].name, names[0]];
        expect(
          await result.current.runAction(
            { type: "packages.watch", names: overlapNames, watch: true },
            overlapNames.map((name) => `package-watch:${name}`)
          )
        ).toBe(false);
      });
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/actions")
        )
      ).toHaveLength(1);
      currentStatus = statusFixture({
        operations: [
          {
            id: "batch",
            kind: "packages.start",
            state: "running",
            startedAt: "2026-10-07T12:00:00Z",
            phases: names.map((name) => ({
              id: `start:${name}`,
              label: name,
              state: "pending",
            })),
          },
        ],
      });
      await act(async () => {
        finishAction(Response.json({ operationId: "batch" }, { status: 202 }));
        expect(await pending).toBe(true);
      });
      expect(result.current.busy).toEqual(
        Object.fromEntries(keys.map((key) => [key, "batch"]))
      );
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          phases: operation.phases.map((phase, index) => ({
            ...phase,
            state: index === 0 ? phaseState : "running",
          })),
        })),
      };
      await act(() => result.current.refresh());
      await waitFor(() =>
        expect(result.current.busy).toEqual({ [keys[1]]: "batch" })
      );
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          state: phaseState === "failed" ? "failed" : "passed",
        })),
      };
      await act(() => result.current.refresh());
      await waitFor(() => expect(result.current.busy).toEqual({}));
    }
  );

  it("derives row progress from active operation phases after reload", async () => {
    const fixture = statusFixture();
    const phases = [
      {
        id: `stop:${fixture.packages[0].name}`,
        label: "Stop",
        state: "running",
      },
      {
        id: `watch:${fixture.packages[1].name}`,
        label: "Watch",
        state: "pending",
      },
      {
        id: `start:${fixture.packages[2].name}`,
        label: "Start",
        state: "passed",
      },
    ] satisfies (typeof fixture.operations)[number]["phases"];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          statusFixture({
            operations: [
              {
                id: "existing",
                kind: "preset.start",
                state: "running",
                startedAt: "2026-10-07T12:00:00Z",
                phases,
              },
            ],
          })
        )
      )
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBeDefined());
    expect(result.current.busy).toEqual({
      [`package:${fixture.packages[0].name}`]: "existing",
      [`package-watch:${fixture.packages[1].name}`]: "existing",
    });
  });

  it("clears a rejected batch's busy rows while preserving unrelated operation progress", async () => {
    const fixture = statusFixture();
    const names = fixture.packages.slice(0, 2).map((item) => item.name);
    const otherName = fixture.packages[2].name;
    const currentStatus = statusFixture({
      operations: [
        {
          id: "other",
          kind: "package.stop",
          state: "running",
          startedAt: "2026-10-07T12:00:00Z",
          phases: [
            { id: `stop:${otherName}`, label: "Stop", state: "running" },
          ],
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation(async (input) =>
          String(input).endsWith("/actions")
            ? Response.json({ error: "Package action failed" }, { status: 409 })
            : Response.json(currentStatus)
        )
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBeDefined());
    await act(async () => {
      expect(
        await result.current.runAction(
          { type: "packages.watch", names, watch: true },
          names.map((name) => `package-watch:${name}`)
        )
      ).toBe(false);
    });
    expect(result.current.busy).toEqual({ [`package:${otherName}`]: "other" });
    expect(result.current.actionError).toBe("Package action failed");
  });

  it("keeps the newest state when an older polling request finishes later", async () => {
    let finishOldRequest: (response: Response) => void = () => undefined;
    const oldRequest = new Promise<Response>((resolve) => {
      finishOldRequest = resolve;
    });
    const oldStatus = statusFixture();
    const latestStatus = statusFixture({
      packages: oldStatus.packages.map((item) => ({
        ...item,
        state: "running",
      })),
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce(Response.json(latestStatus));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useDashboard());
    await act(() => result.current.refresh());
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    await waitFor(() =>
      expect(result.current.status?.packages[0]?.state).toBe("running")
    );
    await act(async () => {
      finishOldRequest(Response.json(oldStatus));
    });
    expect(result.current.status?.packages[0]?.state).toBe("running");
  });
  it("preserves the last good status on refresh failure and clears the connection error on recovery", async () => {
    const fixture = statusFixture();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(fixture))
      .mockResolvedValueOnce(
        Response.json({ error: "Runtime unavailable" }, { status: 503 })
      )
      .mockResolvedValueOnce(Response.json({ ...fixture, seedReady: false }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toEqual(fixture));
    await act(() => result.current.refresh());
    await waitFor(() =>
      expect(result.current.connectionError).toBe("Runtime unavailable")
    );
    expect(result.current.status).toEqual(fixture);
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.connectionError).toBe(""));
    expect(result.current.status?.seedReady).toBe(false);
  });
  it("clears a preset failure on retry and keeps its accepted operation busy until it finishes", async () => {
    let currentStatus = statusFixture({ operations: [] });
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        if (!String(input).endsWith("/actions"))
          return Response.json(currentStatus);
        attempts += 1;
        const id = `attempt-${attempts}`;
        currentStatus = {
          ...currentStatus,
          operations: [
            {
              id,
              kind: "preset.start",
              state: attempts === 1 ? "failed" : "running",
              error: attempts === 1 ? "Build failed" : undefined,
              startedAt: "2026-10-08T12:00:00Z",
              phases: [],
            },
          ],
        };
        return Response.json({ operationId: id }, { status: 202 });
      })
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBeDefined());
    const action = { type: "preset.start", id: "backend" } satisfies Parameters<
      typeof result.current.runAction
    >[0];
    await act(() => result.current.runAction(action, "preset:backend"));
    await waitFor(() =>
      expect(result.current.actionFailures["preset:backend"]?.message).toBe(
        "Build failed"
      )
    );
    await act(() => result.current.runAction(action, "preset:backend"));
    await waitFor(() =>
      expect(result.current.busy["preset:backend"]).toBe("attempt-2")
    );
    expect(result.current.actionFailures).toEqual({});
    currentStatus = {
      ...currentStatus,
      operations: currentStatus.operations.map((operation) => ({
        ...operation,
        state: "passed",
      })),
    };
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.busy).toEqual({}));
  });
  it("retains a completed preset outcome after the backend evicts its operation without making it busy again", async () => {
    let currentStatus = statusFixture({ operations: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        if (!String(input).endsWith("/actions"))
          return Response.json(currentStatus);
        currentStatus = {
          ...currentStatus,
          operations: [
            {
              id: "completed",
              kind: "preset.start",
              state: "failed",
              error: "Build failed",
              startedAt: "2026-10-08T12:00:00Z",
              phases: [],
            },
          ],
        };
        return Response.json({ operationId: "completed" }, { status: 202 });
      })
    );
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.status).toBeDefined());
    await act(() =>
      result.current.runAction(
        { type: "preset.start", id: "backend" },
        "preset:backend"
      )
    );
    await waitFor(() =>
      expect(result.current.actionFailures["preset:backend"]?.message).toBe(
        "Build failed"
      )
    );
    currentStatus = { ...currentStatus, operations: [] };
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.status?.operations).toEqual([]));
    expect(result.current.busy).toEqual({});
    expect(result.current.actionFailures["preset:backend"]?.message).toBe(
      "Build failed"
    );
  });
});
