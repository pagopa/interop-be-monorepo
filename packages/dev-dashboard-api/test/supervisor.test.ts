import type { Package, Preset } from "pagopa-interop-dev-dashboard-contracts";

import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  Child,
  Command,
  Driver,
  ProcessExit,
} from "../src/model/domain/models.js";

import { DASHBOARD_PATHS } from "../src/config/constants.js";
import { supervisorServiceBuilder } from "../src/services/supervisorService.js";
import { readWatchPreferences } from "../src/services/watchPreferenceService.js";

class FakeDriver implements Driver {
  commands: Command[] = [];
  children = new Map<
    string,
    { exit: (result: ProcessExit) => void; stopped: boolean }
  >();
  exitOnStart?: ProcessExit;
  gate?: Promise<void>;
  failPhase?: string;
  failStart?: string;
  failStop?: string;
  stopGate?: Promise<void>;
  async run(command: Command, _log: (line: string) => void): Promise<string> {
    this.commands.push(command);
    await this.gate;
    if (this.failPhase && command.args.includes(this.failPhase))
      throw new Error(`Expected ${this.failPhase} failure`);
    return "";
  }
  async start(
    command: Command,
    _log: (line: string) => void,
    exit: (result: ProcessExit) => void
  ): Promise<Child> {
    this.commands.push(command);
    if (command.source === this.failStart)
      throw new Error(`Expected ${command.source} startup failure`);
    const record = { exit, stopped: false };
    this.children.set(command.source, record);
    if (this.exitOnStart) exit(this.exitOnStart);
    return {
      pid: this.commands.length,
      stop: async () => {
        await this.stopGate;
        if (command.source === this.failStop)
          throw new Error(`Expected ${command.source} stop failure`);
        record.stopped = true;
      },
    };
  }
}
const member = (name: string): Package => ({
  name,
  label: name,
  kind: "worker",
  state: "stopped",
  watch: true,
});
const preset: Preset = {
  id: "pair",
  name: "Pair",
  source: "shared",
  packages: [{ name: "a" }, { name: "b" }],
};
const seedPackages = [
  "pagopa-interop-tenant-process",
  "pagopa-interop-tenant-readmodel-writer-sql",
  "pagopa-interop-catalog-process",
  "pagopa-interop-catalog-readmodel-writer-sql",
];
const directories: string[] = [];
const temporaryWatchPath = (): string => {
  const path = join(tmpdir(), `dashboard-watch-${randomUUID()}`);
  directories.push(path);
  return join(path, "watch.json");
};
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  );
});
const setup = (
  options: {
    watchPath?: string;
    watchPreferences?: Record<string, boolean>;
    personalPath?: string;
    includeSeedPackages?: boolean;
    packages?: Package[];
    watchSource?: (path: string, changed: () => void) => () => void;
  } = {}
) => {
  const driver = new FakeDriver();
  const supervisor = supervisorServiceBuilder({
    beRoot: "/be",
    driver,
    packages: options.packages ?? [
      member("a"),
      member("b"),
      member("outside"),
      member("remote"),
      ...(options.includeSeedPackages
        ? seedPackages.map((name) => member(name))
        : []),
    ],
    presets: [
      {
        ...preset,
        packages: [
          ...preset.packages,
          ...(options.includeSeedPackages
            ? seedPackages.map((name) => ({ name }))
            : []),
        ].map((item) =>
          options.includeSeedPackages ? { ...item, watch: false } : item
        ),
      },
    ],
    personalPath: options.personalPath,
    watchPath: options.watchPath ?? temporaryWatchPath(),
    watchPreferences: options.watchPreferences,
    watchSource: options.watchSource,
  });
  return { driver, supervisor };
};

describe("local dashboard supervisor", () => {
  it("starts four preset members before readiness and keeps seed queued until every member is ready", async () => {
    const names = [...seedPackages, "extra-one", "extra-two"];
    const gates = names.map(() => {
      let resolve: (value: { ok: boolean }) => void = () => undefined;
      const promise = new Promise<{ ok: boolean }>((resolvePromise) => {
        resolve = resolvePromise;
      });
      return { promise, resolve };
    });
    const fetch = vi.fn((input: string) => {
      const index = Number(new URL(input).port) - 5000;
      return gates[index].promise;
    });
    vi.stubGlobal("fetch", fetch);
    const driver = new FakeDriver();
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: names.map((name, index) => ({
        ...member(name),
        port: 5000 + index,
      })),
      presets: [{ ...preset, packages: names.map((name) => ({ name })) }],
    });
    const accepted = supervisor.action({ type: "preset.start", id: "pair" });
    supervisor.action({ type: "seed" });

    try {
      await vi.waitFor(() => expect(driver.children.size).toBe(4));
      expect([...driver.children.keys()]).toEqual(names.slice(0, 4));
      expect(fetch).toHaveBeenCalledTimes(4);
      expect(supervisor.action({ type: "preset.start", id: "pair" })).toEqual(
        accepted
      );
      expect(supervisor.status().operations[1].state).toBe("pending");
      expect(supervisor.status().packages.map((item) => item.state)).toEqual([
        "starting",
        "starting",
        "starting",
        "starting",
        "building",
        "building",
      ]);
      gates.slice(0, 4).forEach((gate) => gate.resolve({ ok: true }));
      await vi.waitFor(() => expect(driver.children.size).toBe(6));
      expect(supervisor.status().seedPrerequisites).toEqual([]);
      expect(supervisor.status().operations[1].state).toBe("pending");
      expect(
        driver.commands.some((command) => command.args.includes("seed"))
      ).toBe(false);
      gates[4].resolve({ ok: true });
      await vi.waitFor(() =>
        expect(supervisor.status().packages[4].state).toBe("running")
      );
      expect(supervisor.status().operations[1].state).toBe("pending");
    } finally {
      gates.forEach((gate) => gate.resolve({ ok: true }));
      await supervisor.idle();
    }

    expect(
      supervisor.status().operations.map((operation) => operation.state)
    ).toEqual(["passed", "passed"]);
    expect(
      driver.commands.filter((command) => command.args.includes("seed"))
    ).toHaveLength(1);
  });

  it("defaults job watch to off without overriding saved preferences", () => {
    const packages: Package[] = [
      { ...member("job"), kind: "job" },
      member("worker"),
      { ...member("service"), kind: "service" },
    ];
    const fresh = setup({ packages }).supervisor.status().packages;
    expect(fresh).toEqual([
      expect.objectContaining({ name: "job", watch: false }),
      expect.objectContaining({ name: "worker", watch: true }),
      expect.objectContaining({ name: "service", watch: true }),
    ]);

    const saved = setup({
      packages,
      watchPreferences: { job: true, worker: false },
    }).supervisor.status().packages;
    expect(saved).toEqual([
      expect.objectContaining({ name: "job", watch: true }),
      expect.objectContaining({ name: "worker", watch: false }),
      expect.objectContaining({ name: "service", watch: true }),
    ]);
  });

  it.each([false, true])(
    "completes a successful one-shot job and releases its watcher (exit during startup: %s)",
    async (exitDuringStartup) => {
      let changed: () => void = () => undefined;
      const closed = vi.fn();
      const watchSource = vi.fn((_path: string, callback: () => void) => {
        changed = callback;
        return closed;
      });
      const { supervisor, driver } = setup({
        packages: [{ ...member("job"), kind: "job" }],
        watchPreferences: { job: true },
        watchSource,
      });
      const result = { code: 0, signal: null } satisfies ProcessExit;
      if (exitDuringStartup) driver.exitOnStart = result;

      supervisor.action({ type: "package.start", name: "job" });
      await supervisor.idle();
      if (!exitDuringStartup) driver.children.get("job")?.exit(result);

      const job = supervisor.status().packages[0];
      expect(job).toMatchObject({ kind: "job", state: "completed" });
      expect(job).not.toHaveProperty("pid");
      expect(job).not.toHaveProperty("error");
      expect(supervisor.status().operations.at(-1)?.state).toBe("passed");
      expect(closed).toHaveBeenCalledTimes(exitDuringStartup ? 0 : 1);
      expect(watchSource).toHaveBeenCalledTimes(exitDuringStartup ? 0 : 1);
      expect(
        supervisor.logs
          .read({ source: "job" })
          .entries.map((entry) => entry.message)
      ).toEqual(["INFO job completed with exit code 0"]);

      changed();
      await supervisor.idle();
      expect(
        driver.commands.filter((command) => command.source === "job")
      ).toHaveLength(1);
      supervisor.action({ type: "package.start", name: "job" });
      await supervisor.idle();
      expect(
        driver.commands.filter((command) => command.source === "job")
      ).toHaveLength(2);
    }
  );

  it.each([
    {
      kind: "job",
      result: { code: 2, signal: null },
      error: "a exited with 2",
      duringStartup: false,
    },
    {
      kind: "job",
      result: { code: null, signal: "SIGTERM" },
      error: "a exited with SIGTERM",
      duringStartup: false,
    },
    {
      kind: "service",
      result: { code: 0, signal: null },
      error: "a exited with 0",
      duringStartup: false,
    },
    {
      kind: "worker",
      result: { code: 0, signal: null },
      error: "a exited with 0",
      duringStartup: false,
    },
    {
      kind: "job",
      result: { code: 2, signal: null },
      error: "a exited with 2",
      duringStartup: true,
    },
    {
      kind: "job",
      result: { code: null, signal: null, error: "Spawn failed" },
      error: "Spawn failed",
      duringStartup: true,
    },
  ] satisfies Array<{
    kind: Package["kind"];
    result: ProcessExit;
    error: string;
    duringStartup: boolean;
  }>)(
    "reports $kind exit $error as failed (during startup: $duringStartup)",
    async ({ kind, result, error, duringStartup }) => {
      const closed = vi.fn();
      const { supervisor, driver } = setup({
        packages: [{ ...member("a"), kind }],
        watchPreferences: { a: true },
        watchSource: () => closed,
      });
      if (duringStartup) driver.exitOnStart = result;

      supervisor.action({ type: "package.start", name: "a" });
      await supervisor.idle();
      if (!duringStartup) driver.children.get("a")?.exit(result);

      const item = supervisor.status().packages[0];
      expect(item).toMatchObject({ state: "failed", error });
      expect(item).not.toHaveProperty("pid");
      expect(closed).toHaveBeenCalledTimes(duringStartup ? 0 : 1);
      expect(supervisor.status().operations.at(-1)?.state).toBe(
        duringStartup ? "failed" : "passed"
      );
      expect(
        supervisor.logs.read({ source: "a" }).entries.at(-1)?.message
      ).toBe(`ERROR ${error}`);
    }
  );

  it("isolates queues and shutdown state between supervisor instances", async () => {
    const first = setup();
    const second = setup();
    let release: () => void = () => undefined;
    first.driver.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    first.supervisor.action({ type: "package.start", name: "a" });
    second.supervisor.action({ type: "package.start", name: "b" });

    try {
      await vi.waitFor(() =>
        expect(second.supervisor.status().operations.at(-1)?.state).toBe(
          "passed"
        )
      );
      await second.supervisor.idle();
      expect(
        second.supervisor.status().packages.find((item) => item.name === "b")
      ).toMatchObject({ state: "running" });
      expect(
        first.supervisor.status().packages.find((item) => item.name === "a")
          ?.state
      ).not.toBe("running");
      expect(first.driver.children.size).toBe(0);

      await second.supervisor.shutdown();
      expect(() =>
        second.supervisor.action({ type: "package.start", name: "a" })
      ).toThrow("Dashboard is shutting down");
    } finally {
      release();
      await first.supervisor.idle();
    }

    first.supervisor.action({ type: "package.start", name: "b" });
    await first.supervisor.idle();

    expect([...first.driver.children.keys()]).toEqual(["a", "b"]);
    expect(
      first.supervisor
        .status()
        .operations.every((operation) => operation.state === "passed")
    ).toBe(true);
    await first.supervisor.shutdown();
  });

  it("starts individual packages with watch enabled without frontend orchestration", async () => {
    const watchSource = vi.fn(() => () => undefined);
    const { supervisor } = setup({ watchSource });

    expect(supervisor.status()).not.toHaveProperty("frontendAvailable");
    expect(supervisor.status().packages.every((item) => item.watch)).toBe(true);
    expect(supervisor.status()).not.toHaveProperty("mode");

    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();

    expect(watchSource).toHaveBeenCalledExactlyOnceWith(
      "/be/packages/a/src",
      expect.any(Function)
    );
  });

  it("autostarts infrastructure only without selecting application packages", async () => {
    const { supervisor, driver } = setup({ includeSeedPackages: true });

    const accepted = supervisor.autostart();
    await supervisor.idle();

    expect(driver.commands.map((command) => command.args.at(-1))).toEqual([
      "recover",
      "start",
      "wait",
      "topics",
      "connector",
    ]);
    expect(driver.children.size).toBe(0);
    expect(supervisor.status().operations).toHaveLength(1);
    expect(supervisor.status().operations[0]).toMatchObject({
      id: accepted.operationId,
      kind: "infra.start",
      state: "passed",
    });
  });

  it("autostarts a selected backend preset after infrastructure in one operation", async () => {
    const { supervisor, driver } = setup();

    const accepted = supervisor.autostart("pair");
    await supervisor.idle();

    const operation = supervisor.status().operations[0];
    expect(supervisor.status().operations).toHaveLength(1);
    expect(operation).toMatchObject({
      id: accepted.operationId,
      kind: "preset.start",
      state: "passed",
    });
    expect(operation.phases.map((phase) => phase.id)).toEqual([
      "infra:recover",
      "infra:start",
      "infra:wait",
      "infra:topics",
      "infra:connector",
      "build",
      "start:a",
      "start:b",
    ]);
    expect(
      driver.commands.slice(0, 5).map((command) => command.args.at(-1))
    ).toEqual(["recover", "start", "wait", "topics", "connector"]);
    expect([...driver.children.keys()]).toEqual(["a", "b"]);
    expect(
      driver.commands.some((command) => command.args.includes("seed"))
    ).toBe(false);
  });

  it("autostarts the frontend backend group with its watch choices without seed or frontend work", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const watchSource = vi.fn(() => () => undefined);
    const { supervisor, driver } = setup({
      includeSeedPackages: true,
      watchSource,
    });

    const accepted = supervisor.autostart("pair");
    expect(supervisor.autostart("pair")).toEqual(accepted);
    await supervisor.idle();

    expect(supervisor.status().operations).toHaveLength(1);
    const operation = supervisor.status().operations[0];
    expect(operation.state).toBe("passed");
    expect(operation.phases.map((phase) => phase.id)).toEqual([
      "infra:recover",
      "infra:start",
      "infra:wait",
      "infra:topics",
      "infra:connector",
      "build",
      "start:a",
      "start:b",
      ...seedPackages.map((name) => `start:${name}`),
    ]);
    expect(watchSource).not.toHaveBeenCalled();
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({ state: "running", watch: false });
    expect(
      supervisor.status().packages.find((item) => item.name === "outside")
    ).toMatchObject({ state: "stopped", watch: true });
    expect(
      driver.commands.some(
        (command) =>
          command.args.includes("seed") || command.args.includes("token")
      )
    ).toBe(false);
    expect(
      driver.commands
        .filter((command) => command.source === "checks")
        .map((command) => command.args.at(-1))
    ).toEqual([]);
  });

  it.each(["recover", "start", "wait", "topics", "connector"])(
    "skips the selected backend preset after autostart infrastructure %s fails",
    async (phase) => {
      const { supervisor, driver } = setup({ includeSeedPackages: true });
      driver.failPhase = phase;

      supervisor.autostart("pair");
      await supervisor.idle();

      const operation = supervisor.status().operations[0];
      expect(operation.state).toBe("failed");
      expect(
        operation.phases.find((item) => item.id === `infra:${phase}`)?.state
      ).toBe("failed");
      const failedIndex = operation.phases.findIndex(
        (item) => item.id === `infra:${phase}`
      );
      expect(
        operation.phases
          .slice(failedIndex + 1)
          .every((item) => item.state === "skipped")
      ).toBe(true);
      expect(
        driver.commands.every(
          (command) =>
            command.args[0] ===
            "/be/scripts/local-development/dashboard-infra.sh"
        )
      ).toBe(true);
      expect(driver.children.size).toBe(0);
      expect(
        supervisor.status().packages.every((item) => item.state === "stopped")
      ).toBe(true);
    }
  );

  it("rejects an unknown autostart preset before queuing infrastructure", () => {
    const { supervisor, driver } = setup();

    expect(() => supervisor.autostart("missing")).toThrow(
      "Unknown preset: missing"
    );
    expect(supervisor.status().operations).toEqual([]);
    expect(driver.commands).toEqual([]);
  });

  it("does not queue a watch restart while an explicit stop is pending", async () => {
    let changed: () => void = () => undefined;
    const { supervisor, driver } = setup({
      watchSource: (_path, callback) => {
        changed = callback;
        return () => undefined;
      },
    });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    let finishStop: () => void = () => undefined;
    driver.stopGate = new Promise<void>((resolve) => {
      finishStop = resolve;
    });
    supervisor.action({ type: "packages.stop", names: ["a"] });
    try {
      await vi.waitFor(() =>
        expect(supervisor.status().operations.at(-1)?.phases[0].state).toBe(
          "running"
        )
      );
      changed();
      expect(
        supervisor.status().operations.map((operation) => operation.kind)
      ).toEqual(["package.start", "packages.stop"]);
    } finally {
      finishStop();
    }
    await supervisor.idle();
    expect(
      supervisor.status().packages.find((item) => item.name === "a")?.state
    ).toBe("stopped");
  });
  it("retains ownership and watch after a failed stop so a later watch change stops the original child", async () => {
    const closeWatcher = vi.fn();
    const { supervisor, driver } = setup({ watchSource: () => closeWatcher });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    const original = driver.children.get("a");
    driver.failStop = "a";
    supervisor.action({ type: "packages.stop", names: ["a"] });
    await supervisor.idle();
    expect(closeWatcher).not.toHaveBeenCalled();
    driver.failStop = undefined;
    supervisor.action({ type: "packages.watch", names: ["a"], watch: false });
    await supervisor.idle();
    expect(original?.stopped).toBe(true);
    expect(driver.children.get("a")).not.toBe(original);
    expect(closeWatcher).toHaveBeenCalledExactlyOnceWith();
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({ state: "running", watch: false });
  });
  it("keeps watch unchanged after a failed stop while applying it to other selected packages", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    driver.failStop = "a";
    supervisor.action({
      type: "packages.watch",
      names: ["a", "b"],
      watch: false,
    });
    await supervisor.idle();
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({
      watch: true,
      state: "running",
      error: "Expected a stop failure",
    });
    expect(
      supervisor.status().packages.find((item) => item.name === "b")
    ).toMatchObject({ watch: false, state: "stopped" });
    expect(driver.children.has("b")).toBe(false);
  });
  it("does not start any selected packages when their shared build fails", async () => {
    const { supervisor, driver } = setup();
    driver.failPhase = "build";
    supervisor.action({ type: "packages.start", names: ["a", "b"] });
    await supervisor.idle();
    expect(driver.children.size).toBe(0);
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      state: "failed",
      phases: [{ state: "failed" }, { state: "skipped" }, { state: "skipped" }],
    });
    expect(
      supervisor
        .status()
        .packages.filter((item) => item.state === "failed")
        .map((item) => item.name)
    ).toEqual(["a", "b"]);
  });
  it("continues a bulk start after an individual failure and records each row result", async () => {
    const { supervisor, driver } = setup();
    driver.failStart = "a";
    supervisor.action({ type: "packages.start", names: ["a", "b"] });
    await supervisor.idle();
    expect([...driver.children.keys()]).toEqual(["b"]);
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      state: "failed",
      phases: [{ state: "passed" }, { state: "failed" }, { state: "passed" }],
    });
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({ state: "failed", error: "Expected a startup failure" });
    expect(
      supervisor.status().packages.find((item) => item.name === "b")?.state
    ).toBe("running");
  });
  it("continues a bulk stop after an individual failure and exposes the failed row error", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    driver.failStop = "a";
    supervisor.action({ type: "packages.stop", names: ["a", "b"] });
    await supervisor.idle();
    expect(driver.children.get("a")?.stopped).toBe(false);
    expect(driver.children.get("b")?.stopped).toBe(true);
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({ state: "running", error: "Expected a stop failure" });
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      state: "failed",
      phases: [{ state: "failed" }, { state: "passed" }],
    });
  });
  it("bulk starts only selected missing packages with one shared build", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "package.start", name: "outside" });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    const existing = driver.children.get("a");
    const count = driver.commands.length;
    supervisor.action({ type: "packages.start", names: ["a", "b", "b"] });
    await supervisor.idle();
    const commands = driver.commands.slice(count);
    expect(
      commands.filter((command) => command.args.includes("build"))
    ).toHaveLength(1);
    expect(
      commands.find((command) => command.args.includes("build"))?.args
    ).toContain("--filter=b^...");
    expect(
      commands
        .filter((command) => command.source !== "orchestration")
        .map((command) => command.source)
    ).toEqual(["b"]);
    expect([...driver.children.keys()]).toEqual(["outside", "a", "b"]);
    expect(driver.children.get("a")).toBe(existing);
    expect(driver.children.get("outside")?.stopped).toBe(false);
    expect(
      supervisor
        .status()
        .operations.at(-1)
        ?.phases.map((phase) => phase.id)
    ).toEqual(["build", "start:a", "start:b"]);
  });
  it("bulk stops selected packages and leaves unrelated processes running", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "preset.start", id: "pair" });
    supervisor.action({ type: "package.start", name: "outside" });
    await supervisor.idle();
    supervisor.action({ type: "packages.stop", names: ["a", "b"] });
    await supervisor.idle();
    expect(driver.children.get("a")?.stopped).toBe(true);
    expect(driver.children.get("b")?.stopped).toBe(true);
    expect(driver.children.get("outside")?.stopped).toBe(false);
    expect(
      supervisor
        .status()
        .packages.filter((item) => item.state === "running")
        .map((item) => item.name)
    ).toEqual(["outside"]);
  });
  it("bulk changes watch only for selected packages, restarting only changed running members", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "package.start", name: "a" });
    supervisor.action({ type: "package.start", name: "outside" });
    await supervisor.idle();
    const previous = driver.children.get("a");
    supervisor.action({
      type: "packages.watch",
      names: ["a", "b"],
      watch: false,
    });
    await supervisor.idle();
    expect(previous?.stopped).toBe(true);
    expect(driver.children.get("a")).not.toBe(previous);
    expect(driver.children.has("b")).toBe(false);
    expect(driver.children.get("outside")?.stopped).toBe(false);
    expect(
      supervisor.status().packages.map((item) => [item.name, item.watch])
    ).toEqual([
      ["a", false],
      ["b", false],
      ["outside", true],
      ["remote", true],
    ]);
    const count = driver.commands.length;
    supervisor.action({
      type: "packages.watch",
      names: ["a", "b"],
      watch: false,
    });
    await supervisor.idle();
    expect(driver.commands).toHaveLength(count);
  });
  it.each(["packages.start", "packages.stop", "packages.watch"])(
    "validates every selected member before accepting %s",
    (type) => {
      const { supervisor, driver } = setup();
      expect(() =>
        supervisor.action({
          type,
          names: ["a", "missing"],
          ...(type === "packages.watch" ? { watch: false } : {}),
        })
      ).toThrow(/Unknown package: missing/);
      expect(driver.commands).toEqual([]);
      expect(supervisor.status().operations).toEqual([]);
    }
  );
  it("starts only the chosen package without a support catalogue or infrastructure action", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "package.start", name: "remote" });
    await supervisor.idle();
    expect([...driver.children.keys()]).toEqual(["remote"]);
    expect(
      driver.commands.some((command) => command.executable === "bash")
    ).toBe(false);
    expect(
      supervisor.status().packages.find((item) => item.name === "remote")?.state
    ).toBe("running");
  });
  it("checks effective launch ports when local environment overrides changed after discovery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const driver = new FakeDriver();
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: [
        { ...member("a"), port: 9999 },
        { ...member("b"), port: 10000 },
      ],
      presets: [],
      environment: async () => ({ PORT: "9999" }),
    });
    supervisor.action({ type: "package.start", name: "a" });
    supervisor.action({ type: "package.start", name: "b" });
    await supervisor.idle();
    expect(supervisor.status().operations[1]).toMatchObject({
      state: "failed",
      error: expect.stringContaining("port 9999"),
    });
    expect([...driver.children.keys()]).toEqual(["a"]);
  });
  it("restores unlaunched preset members after a startup failure without changing other running packages", async () => {
    const driver = new FakeDriver();
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: ["a", "b", "c", "d", "e", "outside"].map(member),
      presets: [
        {
          ...preset,
          packages: ["a", "b", "c", "d", "e"].map((name) => ({ name })),
        },
      ],
    });
    supervisor.action({ type: "package.start", name: "outside" });
    await supervisor.idle();
    driver.failStart = "a";
    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    expect(supervisor.status().packages.map((p) => [p.name, p.state])).toEqual([
      ["a", "failed"],
      ["b", "running"],
      ["c", "running"],
      ["d", "running"],
      ["e", "stopped"],
      ["outside", "running"],
    ]);
    expect(supervisor.status().operations.at(-1)?.phases.at(-1)).toMatchObject({
      id: "start:e",
      state: "skipped",
    });
    expect(driver.children.get("outside")?.stopped).toBe(false);
  });
  it("prevents queued start requests from sharing a port without stopping the existing child", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const driver = new FakeDriver();
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: [
        { ...member("a"), port: 9999 },
        { ...member("b"), port: 9999 },
      ],
      presets: [],
    });
    supervisor.action({ type: "package.start", name: "a" });
    supervisor.action({ type: "package.start", name: "b" });
    await supervisor.idle();
    expect(supervisor.status().operations.map((o) => o.state)).toEqual([
      "passed",
      "failed",
    ]);
    expect(supervisor.status().operations[1].error).toMatch(/port 9999/);
    expect([...driver.children.keys()]).toEqual(["a"]);
    expect(driver.children.get("a")?.stopped).toBe(false);
  });
  it("uses the catalog directory for packages whose workspace name differs from their directory", async () => {
    const driver = new FakeDriver();
    const name = "pagopa-interop-dtd-catalog-exporter-job";
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: [{ ...member(name), label: "dtd-catalog-exporter" }],
      presets: [],
    });
    supervisor.action({ type: "package.start", name });
    await supervisor.idle();
    expect(
      driver.commands.find((command) => command.source === name)?.cwd
    ).toBe("/be/packages/dtd-catalog-exporter");
  });
  it("reports missing seed prerequisites and refuses seed execution until all four run", async () => {
    const driver = new FakeDriver();
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: seedPackages.map((name) => member(name)),
      presets: [
        { ...preset, packages: seedPackages.map((name) => ({ name })) },
      ],
    });
    expect(supervisor.status().seedPrerequisites).toEqual(seedPackages);
    supervisor.action({ type: "seed" });
    await supervisor.idle();
    expect(supervisor.status().operations[0]).toMatchObject({
      state: "failed",
      error: expect.stringContaining("Seed requires running packages"),
    });
    expect(
      driver.commands.some((command) => command.args.includes("seed"))
    ).toBe(false);
    supervisor.action({ type: "package.start", name: seedPackages[0] });
    await supervisor.idle();
    expect(supervisor.status().seedPrerequisites).toEqual(
      seedPackages.slice(1)
    );
    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    expect(supervisor.status().seedPrerequisites).toEqual([]);
    supervisor.action({ type: "seed" });
    await supervisor.idle();
    expect(
      driver.commands.filter((command) => command.args.includes("seed"))
    ).toHaveLength(1);
    supervisor.action({ type: "package.stop", name: seedPackages[1] });
    await supervisor.idle();
    expect(supervisor.status().seedPrerequisites).toEqual([seedPackages[1]]);
  });
  it("builds and starts only the four seed packages without infrastructure or seed commands", async () => {
    const { supervisor, driver } = setup({ includeSeedPackages: true });
    const previous = supervisor.status();
    supervisor.action({ type: "seed.prepare" });
    await supervisor.idle();
    expect(driver.commands).toHaveLength(5);
    expect(driver.commands[0]).toMatchObject({
      executable: "pnpm",
      args: [
        "exec",
        "turbo",
        "run",
        "build",
        ...seedPackages.map((name) => `--filter=${name}^...`),
        "--concurrency=2",
      ],
    });
    expect(driver.commands.slice(1).map((command) => command.source)).toEqual(
      seedPackages
    );
    expect(
      driver.commands.some((command) => command.executable === "bash")
    ).toBe(false);
    expect(supervisor.status()).toMatchObject({
      seedReady: false,
      seedPrerequisites: [],
      presets: previous.presets,
      infrastructure: previous.infrastructure,
    });
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      kind: "seed.prepare",
      state: "passed",
      phases: [
        { id: "build", state: "passed" },
        ...seedPackages.map((name) => ({
          id: `start:${name}`,
          state: "passed",
        })),
      ],
    });
  });
  it("retains the complete seed package metadata while prerequisites shrink, returning cloned data", async () => {
    const { supervisor } = setup({ includeSeedPackages: true });
    const before = supervisor.status();
    expect(before.seedPackages).toEqual(seedPackages);
    expect(before.seedPrerequisites).toEqual(seedPackages);
    before.seedPackages.splice(0);
    expect(supervisor.status().seedPackages).toEqual(seedPackages);
    supervisor.action({ type: "package.start", name: seedPackages[0] });
    await supervisor.idle();
    expect(supervisor.status().seedPackages).toEqual(seedPackages);
    expect(supervisor.status().seedPrerequisites).toEqual(
      seedPackages.slice(1)
    );
    supervisor.action({ type: "seed.prepare" });
    await supervisor.idle();
    expect(supervisor.status().seedPackages).toEqual(seedPackages);
    expect(supervisor.status().seedPrerequisites).toEqual([]);
  });
  it("keeps running children and watch preferences while preparing missing seed packages", async () => {
    const closeWatcher = vi.fn();
    const { supervisor, driver } = setup({
      includeSeedPackages: true,
      watchSource: () => closeWatcher,
    });
    supervisor.action({
      type: "package.watch",
      name: seedPackages[1],
      watch: true,
    });
    supervisor.action({ type: "package.watch", name: "outside", watch: true });
    supervisor.action({ type: "package.start", name: "outside" });
    supervisor.action({ type: "package.start", name: seedPackages[0] });
    await supervisor.idle();
    const existing = driver.children.get(seedPackages[0]);
    const outside = driver.children.get("outside");
    const watches = supervisor
      .status()
      .packages.map((item) => [item.name, item.watch]);
    const count = driver.commands.length;
    supervisor.action({ type: "seed.prepare" });
    await supervisor.idle();
    expect(
      driver.commands
        .slice(count)
        .filter((command) => command.source !== "orchestration")
        .map((command) => command.source)
    ).toEqual(seedPackages.slice(1));
    expect(
      driver.commands
        .slice(count)
        .find((command) => command.executable === "pnpm")?.args
    ).not.toContain(`--filter=${seedPackages[0]}^...`);
    expect(driver.children.get(seedPackages[0])).toBe(existing);
    expect(driver.children.get("outside")).toBe(outside);
    expect([...driver.children.values()].every((child) => !child.stopped)).toBe(
      true
    );
    expect(closeWatcher).not.toHaveBeenCalled();
    expect(
      supervisor.status().packages.map((item) => [item.name, item.watch])
    ).toEqual(watches);
    expect(
      supervisor
        .status()
        .operations.at(-1)
        ?.phases.find((phase) => phase.id === `start:${seedPackages[0]}`)?.state
    ).toBe("skipped");
    const warmCount = driver.commands.length;
    supervisor.action({ type: "seed.prepare" });
    await supervisor.idle();
    expect(driver.commands).toHaveLength(warmCount);
    expect(
      supervisor
        .status()
        .operations.at(-1)
        ?.phases.map((phase) => phase.state)
    ).toEqual(["skipped", "skipped", "skipped", "skipped", "skipped"]);
    expect([...driver.children.values()].every((child) => !child.stopped)).toBe(
      true
    );
    expect(closeWatcher).not.toHaveBeenCalled();
  });
  it("skips every seed service start after a failed preparation build", async () => {
    const { supervisor, driver } = setup({ includeSeedPackages: true });
    driver.failPhase = "build";
    supervisor.action({ type: "seed.prepare" });
    await supervisor.idle();
    expect(driver.children.size).toBe(0);
    expect(
      supervisor
        .status()
        .operations.at(-1)
        ?.phases.map((phase) => phase.state)
    ).toEqual(["failed", "skipped", "skipped", "skipped", "skipped"]);
  });
  it("settles already launched seed services after one startup fails", async () => {
    const { supervisor, driver } = setup({ includeSeedPackages: true });
    driver.failStart = seedPackages[1];
    supervisor.action({ type: "seed.prepare" });
    await supervisor.idle();
    expect([...driver.children.keys()]).toEqual([
      seedPackages[0],
      ...seedPackages.slice(2),
    ]);
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      state: "failed",
    });
    expect(
      supervisor
        .status()
        .operations.at(-1)
        ?.phases.slice(1)
        .map((phase) => phase.state)
    ).toEqual(["passed", "failed", "passed", "passed"]);
    expect(
      supervisor
        .status()
        .packages.filter((item) => seedPackages.slice(2).includes(item.name))
        .every((item) => item.state === "running")
    ).toBe(true);
  });
  it.each(seedPackages)(
    "rejects preparation before any command when %s is absent",
    (missing) => {
      const driver = new FakeDriver();
      const supervisor = supervisorServiceBuilder({
        beRoot: "/be",
        driver,
        packages: seedPackages.filter((name) => name !== missing).map(member),
        presets: [],
      });
      expect(() => supervisor.action({ type: "seed.prepare" })).toThrow(
        `Unknown package: ${missing}`
      );
      expect(driver.commands).toEqual([]);
      expect(supervisor.status().operations).toEqual([]);
    }
  );
  it("deduplicates in-flight seed preparation with the same operation id", async () => {
    const { supervisor, driver } = setup({ includeSeedPackages: true });
    let release: () => void = () => undefined;
    driver.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const accepted = supervisor.action({ type: "seed.prepare" });
    try {
      expect(supervisor.action({ type: "seed.prepare" })).toEqual(accepted);
    } finally {
      release();
    }
    await supervisor.idle();
    expect(supervisor.status().operations).toHaveLength(1);
    expect(
      driver.commands.filter((command) => command.executable === "pnpm")
    ).toHaveLength(1);
  });
  it("starts preset members additively without infrastructure, seed, token or frontend commands", async () => {
    const { supervisor, driver } = setup({ includeSeedPackages: true });
    const accepted = supervisor.action({ type: "preset.start", id: "pair" });
    expect(supervisor.action({ type: "preset.start", id: "pair" })).toEqual(
      accepted
    );
    await supervisor.idle();
    expect(supervisor.status().operations[0]).toMatchObject({
      state: "passed",
    });
    expect(
      supervisor.status().operations[0].phases.map((phase) => phase.id)
    ).toEqual([
      "build",
      "start:a",
      "start:b",
      ...seedPackages.map((name) => `start:${name}`),
    ]);
    expect(driver.commands.map((command) => command.source)).toEqual([
      "orchestration",
      "a",
      "b",
      ...seedPackages,
    ]);
    const firstCommands = driver.commands.length;
    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    expect(driver.commands).toHaveLength(firstCommands);
    expect(
      supervisor
        .status()
        .operations.at(-1)
        ?.phases.every((phase) => phase.state === "skipped")
    ).toBe(true);
  });
  it.each(["shared", "personal"] satisfies Preset["source"][])(
    "does not implicitly seed a %s package preset",
    async (source) => {
      const driver = new FakeDriver();
      const supervisor = supervisorServiceBuilder({
        beRoot: "/be",
        driver,
        packages: seedPackages.map(member),
        presets: [
          {
            ...preset,
            source,
            packages: seedPackages.map((name) => ({ name })),
          },
        ],
      });
      supervisor.action({ type: "preset.start", id: "pair" });
      await supervisor.idle();
      expect(supervisor.status().operations.at(-1)?.state).toBe("passed");
      expect(
        supervisor
          .status()
          .operations.at(-1)
          ?.phases.map((phase) => phase.id)
      ).not.toContain("seed");
      expect(
        driver.commands.some((command) => command.args.includes("seed"))
      ).toBe(false);
    }
  );
  it.each(["fullstack.start", "fullstack.stop", "frontend.restart"])(
    "rejects removed frontend control %s before queuing any command",
    (type) => {
      const { supervisor, driver } = setup();
      expect(() =>
        supervisor.action({
          type,
          ...(type === "frontend.restart" ? { mode: "local" } : {}),
        })
      ).toThrow();
      expect(supervisor.status().operations).toEqual([]);
      expect(driver.commands).toEqual([]);
    }
  );
  it("serializes concurrent personal preset writes without losing either definition", async () => {
    const path = await mkdtemp(join(tmpdir(), "dashboard-presets-"));
    directories.push(path);
    const { supervisor } = setup({ personalPath: join(path, "presets.json") });
    await Promise.all([
      supervisor.savePreset({
        id: "first",
        name: "First",
        packages: [{ name: "a" }],
      }),
      supervisor.savePreset({
        id: "second",
        name: "Second",
        packages: [{ name: "b" }],
      }),
    ]);
    expect(
      supervisor.status().presets.filter((p) => p.source === "personal")
    ).toHaveLength(2);
    expect(
      JSON.parse(await readFile(join(path, "presets.json"), "utf8"))
    ).toHaveLength(2);
  });
  it("checks the versioned BFF health URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const driver = new FakeDriver();
    const name = "pagopa-interop-backend-for-frontend";
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: [{ ...member(name), port: 3600 }],
      presets: [],
    });
    supervisor.action({ type: "package.start", name });
    await supervisor.idle();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3600/backend-for-frontend/0.0/status",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
  it("deduplicates the same in-flight start action", async () => {
    const { driver, supervisor } = setup();
    let release: () => void = () => undefined;
    driver.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = supervisor.action({ type: "package.start", name: "a" });
    const second = supervisor.action({ type: "package.start", name: "a" });
    expect(second.operationId).toBe(first.operationId);
    release();
    await supervisor.idle();
    expect(driver.commands.filter((c) => c.executable === "pnpm")).toHaveLength(
      1
    );
  });
  it("returns an operation before a long command finishes and serializes mutations", async () => {
    const { driver, supervisor } = setup();
    let release: () => void = () => undefined;
    driver.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = supervisor.action({ type: "package.start", name: "a" });
    const second = supervisor.action({ type: "package.stop", name: "a" });
    expect(first.operationId).not.toBe(second.operationId);
    await Promise.resolve();
    expect(
      supervisor.status().operations.find((op) => op.id === second.operationId)
        ?.state
    ).toBe("pending");
    release();
    await supervisor.idle();
    expect(
      supervisor.status().packages.find((p) => p.name === "a")?.state
    ).toBe("stopped");
  });
  it("starts only the selected package after building its workspace dependencies", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    expect(
      driver.commands.filter((c) => c.executable === "pnpm")[0]?.args
    ).toEqual([
      "exec",
      "turbo",
      "run",
      "build",
      "--filter=a^...",
      "--concurrency=2",
    ]);
    expect([...driver.children.keys()]).toEqual(["a"]);
    expect(
      supervisor.status().packages.find((p) => p.name === "a")?.watch
    ).toBe(true);
    expect(driver.commands.find((c) => c.source === "a")?.args).not.toContain(
      "--watch"
    );
  });
  it("starts a preset additively and stops every member without touching outsiders", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "package.start", name: "a" });
    supervisor.action({ type: "package.start", name: "outside" });
    await supervisor.idle();
    const aStarts = driver.commands.filter((c) => c.source === "a").length;
    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    expect(driver.commands.filter((c) => c.source === "a")).toHaveLength(
      aStarts
    );
    supervisor.action({ type: "preset.stop", id: "pair" });
    await supervisor.idle();
    expect(driver.children.get("a")?.stopped).toBe(true);
    expect(driver.children.get("b")?.stopped).toBe(true);
    expect(driver.children.get("outside")?.stopped).toBe(false);
  });
  it("continues stopping preset members after one stop fails", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "preset.start", id: "pair" });
    supervisor.action({ type: "package.start", name: "outside" });
    await supervisor.idle();
    driver.failStop = "a";

    supervisor.action({ type: "preset.stop", id: "pair" });
    await supervisor.idle();

    expect(driver.children.get("a")?.stopped).toBe(false);
    expect(driver.children.get("b")?.stopped).toBe(true);
    expect(driver.children.get("outside")?.stopped).toBe(false);
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({
      state: "running",
      error: "Expected a stop failure",
    });
    expect(
      supervisor.status().packages.find((item) => item.name === "b")?.state
    ).toBe("stopped");
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      kind: "preset.stop",
      state: "failed",
      error: "Expected a stop failure",
      phases: [
        { id: "stop:a", state: "failed", error: "Expected a stop failure" },
        { id: "stop:b", state: "passed" },
      ],
    });
  });
  it("isolates crashes and never automatically restarts a crashed service", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    const commands = driver.commands.length;
    driver.children.get("a")?.exit({ code: 2, signal: null });
    expect(
      supervisor.status().packages.find((p) => p.name === "a")?.state
    ).toBe("failed");
    expect(
      supervisor.status().packages.find((p) => p.name === "b")?.state
    ).toBe("running");
    expect(driver.commands).toHaveLength(commands);
  });
  it("watch toggles restart only a running member and persist settings for stopped members", async () => {
    const { supervisor, driver } = setup();
    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    supervisor.action({ type: "package.watch", name: "a", watch: false });
    supervisor.action({ type: "package.watch", name: "outside", watch: false });
    await supervisor.idle();
    expect(driver.commands.filter((c) => c.source === "a")).toHaveLength(2);
    expect(driver.commands.filter((c) => c.source === "b")).toHaveLength(1);
    expect(driver.children.has("outside")).toBe(false);
    expect(
      supervisor.status().packages.find((p) => p.name === "outside")?.watch
    ).toBe(false);
  });
  it("restores per-package watch choices after dashboard restart and preserves them through infrastructure reset", async () => {
    const root = await mkdtemp(join(tmpdir(), "dashboard-preferences-"));
    directories.push(root);
    const watchPath = join(root, DASHBOARD_PATHS.watchPreferences);
    const personalPath = join(root, DASHBOARD_PATHS.personalPresets);
    const watchSource = vi.fn(() => () => undefined);
    const first = setup({
      watchPath,
      personalPath,
      watchSource,
      watchPreferences: await readWatchPreferences(watchPath),
    });
    await first.supervisor.savePreset({
      id: "personal",
      name: "Personal",
      packages: [{ name: "a", watch: false }],
    });
    const savedPresets = await readFile(personalPath, "utf8");
    first.supervisor.action({ type: "package.start", name: "a" });
    await first.supervisor.idle();
    first.supervisor.action({ type: "package.watch", name: "a", watch: false });
    first.supervisor.action({
      type: "package.watch",
      name: "outside",
      watch: false,
    });
    first.supervisor.action({
      type: "packages.watch",
      names: ["b", "remote"],
      watch: false,
    });
    first.supervisor.action({
      type: "package.watch",
      name: "remote",
      watch: true,
    });
    await first.supervisor.idle();
    await first.supervisor.shutdown();

    const watchPreferences = await readWatchPreferences(watchPath);
    const second = setup({
      watchPath,
      personalPath,
      watchPreferences,
      watchSource,
    });
    const expected = [
      { name: "a", watch: false },
      { name: "b", watch: false },
      { name: "outside", watch: false },
      { name: "remote", watch: true },
    ];
    expect(
      second.supervisor
        .status()
        .packages.map(({ name, watch }) => ({ name, watch }))
    ).toEqual(expected);
    watchSource.mockClear();
    second.supervisor.action({ type: "package.start", name: "a" });
    await second.supervisor.idle();
    expect(watchSource).not.toHaveBeenCalled();
    second.supervisor.action({ type: "infra.reset", confirm: true });
    await second.supervisor.idle();
    expect(
      second.supervisor
        .status()
        .packages.map(({ name, watch }) => ({ name, watch }))
    ).toEqual(expected);
    expect(await readFile(personalPath, "utf8")).toBe(savedPresets);
    expect(JSON.parse(await readFile(watchPath, "utf8"))).toEqual({
      a: false,
      outside: false,
      b: false,
      remote: true,
    });
    await second.supervisor.shutdown();
  });
  it("persists a watch choice even when restarting its running package fails", async () => {
    const watchPath = temporaryWatchPath();
    const { supervisor, driver } = setup({ watchPath });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    driver.failStart = "a";

    supervisor.action({ type: "package.watch", name: "a", watch: false });
    await supervisor.idle();

    expect(supervisor.status().operations.at(-1)?.state).toBe("failed");
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({
      state: "failed",
      watch: false,
    });
    const restarted = setup({
      watchPath,
      watchPreferences: await readWatchPreferences(watchPath),
    });
    expect(
      restarted.supervisor.status().packages.find((item) => item.name === "a")
        ?.watch
    ).toBe(false);
  });
  it("keeps the watch choice unchanged and reports failed persistence", async () => {
    const root = await mkdtemp(join(tmpdir(), "dashboard-watch-failure-"));
    directories.push(root);
    const blocker = join(root, "not-a-directory");
    await writeFile(blocker, "Preserve this file");
    const watchPath = join(blocker, "watch.json");
    const { supervisor } = setup({ watchPath });

    supervisor.action({ type: "package.watch", name: "a", watch: false });
    await supervisor.idle();

    expect(supervisor.status().operations.at(-1)).toMatchObject({
      state: "failed",
      phases: [{ id: "watch:a", state: "failed" }],
    });
    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({
      state: "stopped",
      watch: true,
    });
    expect(await readFile(blocker, "utf8")).toBe("Preserve this file");

    await rm(blocker);
    supervisor.action({ type: "package.watch", name: "b", watch: false });
    await supervisor.idle();

    expect(supervisor.status().operations.at(-1)?.state).toBe("passed");
    expect(await readWatchPreferences(watchPath)).toEqual({ b: false });
  });
  it("reports launched preset members as failed when their watch preferences cannot be saved and skips unlaunched members", async () => {
    const root = await mkdtemp(
      join(tmpdir(), "dashboard-preset-watch-failure-")
    );
    directories.push(root);
    const blocker = join(root, "not-a-directory");
    await writeFile(blocker, "Preserve this file");
    const { supervisor, driver } = setup({
      includeSeedPackages: true,
      watchPath: join(blocker, "watch.json"),
    });

    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();

    expect(
      supervisor.status().packages.find((item) => item.name === "a")
    ).toMatchObject({
      state: "failed",
      watch: true,
    });
    expect(
      supervisor.status().packages.find((item) => item.name === "b")?.state
    ).toBe("failed");
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      state: "failed",
      phases: [
        { id: "build", state: "passed" },
        { id: "start:a", state: "failed" },
        { id: "start:b", state: "failed" },
        ...seedPackages.slice(0, 2).map((name) => ({
          id: `start:${name}`,
          state: "failed",
        })),
        ...seedPackages.slice(2).map((name) => ({
          id: `start:${name}`,
          state: "skipped",
        })),
      ],
    });
    expect(
      supervisor
        .status()
        .packages.filter((item) => seedPackages.slice(2).includes(item.name))
        .every((item) => item.state === "stopped")
    ).toBe(true);
    expect(driver.children.size).toBe(0);
  });
  it("watches sources only while the service runs and never revives a crashed service", async () => {
    let changed: () => void = () => undefined;
    let closed = 0;
    const { supervisor, driver } = setup({
      watchSource: (_path, callback) => {
        changed = callback;
        return () => {
          closed++;
        };
      },
    });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    changed();
    await supervisor.idle();
    expect(driver.commands.filter((c) => c.source === "a")).toHaveLength(2);
    driver.children.get("a")?.exit({ code: 1, signal: null });
    changed();
    await supervisor.idle();
    expect(driver.commands.filter((c) => c.source === "a")).toHaveLength(2);
    expect(
      supervisor.status().packages.find((p) => p.name === "a")?.state
    ).toBe("failed");
    expect(closed).toBeGreaterThan(0);
  });
  it("does not apply an obsolete watch restart after an earlier queued stop", async () => {
    let changed: () => void = () => undefined;
    const { supervisor, driver } = setup({
      watchSource: (_path, callback) => {
        changed = callback;
        return () => undefined;
      },
    });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    let release: () => void = () => undefined;
    driver.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    supervisor.action({ type: "infra.start" });
    await vi.waitFor(() =>
      expect(supervisor.status().operations.at(-1)?.state).toBe("running")
    );
    supervisor.action({ type: "package.stop", name: "a" });
    changed();

    release();
    await supervisor.idle();

    expect(
      driver.commands.filter((command) => command.source === "a")
    ).toHaveLength(1);
    expect(driver.children.get("a")?.stopped).toBe(true);
    expect(
      supervisor.status().packages.find((item) => item.name === "a")?.state
    ).toBe("stopped");
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      kind: "package.restart",
      state: "passed",
      phases: [
        { id: "stop:a", state: "skipped" },
        { id: "build", state: "skipped" },
        { id: "start:a", state: "skipped" },
      ],
    });

    supervisor.action({ type: "package.restart", name: "a" });
    await supervisor.idle();
    expect(
      driver.commands.filter((command) => command.source === "a")
    ).toHaveLength(2);
    expect(
      supervisor.status().packages.find((item) => item.name === "a")?.state
    ).toBe("running");
  });
  it("preserves a manual restart queued after an obsolete automatic watch restart", async () => {
    let changed: () => void = () => undefined;
    const { supervisor, driver } = setup({
      watchSource: (_path, callback) => {
        changed = callback;
        return () => undefined;
      },
    });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    const original = driver.children.get("a");
    let release: () => void = () => undefined;
    driver.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    supervisor.action({ type: "infra.start" });
    await vi.waitFor(() =>
      expect(supervisor.status().operations.at(-1)?.state).toBe("running")
    );
    supervisor.action({ type: "package.stop", name: "a" });
    changed();
    const automaticId = supervisor.status().operations.at(-1)?.id;
    changed();
    const manual = supervisor.action({ type: "package.restart", name: "a" });
    try {
      expect(manual.operationId).not.toBe(automaticId);
      expect(supervisor.status().operations).toHaveLength(5);
    } finally {
      release();
      await supervisor.idle();
    }

    expect(original?.stopped).toBe(true);
    expect(
      supervisor.status().packages.find((item) => item.name === "a")?.state
    ).toBe("running");
    expect(
      driver.commands.filter((command) => command.source === "a")
    ).toHaveLength(2);
    expect(
      supervisor
        .status()
        .operations.find((operation) => operation.id === automaticId)
    ).toMatchObject({
      kind: "package.restart",
      state: "passed",
      phases: [
        { id: "stop:a", state: "skipped" },
        { id: "build", state: "skipped" },
        { id: "start:a", state: "skipped" },
      ],
    });
    expect(
      supervisor
        .status()
        .operations.find((operation) => operation.id === manual.operationId)
    ).toMatchObject({
      kind: "package.restart",
      state: "passed",
      phases: [
        { id: "stop:a", state: "skipped" },
        { id: "build", state: "passed" },
        { id: "start:a", state: "passed" },
      ],
    });
  });
  it("rejects unknown names and reset without explicit confirmation", () => {
    const { supervisor, driver } = setup();
    expect(() =>
      supervisor.action({ type: "package.start", name: "missing" })
    ).toThrow(/unknown/i);
    expect(() =>
      supervisor.action({ type: "infra.reset", confirm: false })
    ).toThrow(/confirm/i);
    expect(driver.commands).toEqual([]);
  });
  it("infra stop/reset stops applications first and preserves personal preset definitions", async () => {
    const path = await mkdtemp(join(tmpdir(), "dashboard-"));
    directories.push(path);
    const personalPath = join(path, "presets.json");
    const { supervisor, driver } = setup({ personalPath });
    await supervisor.savePreset({
      name: "Personal",
      packages: [{ name: "a" }],
    });
    supervisor.action({ type: "package.start", name: "a" });
    await supervisor.idle();
    supervisor.action({ type: "infra.reset", confirm: true });
    await supervisor.idle();
    expect(driver.children.get("a")?.stopped).toBe(true);
    expect(driver.commands.some((c) => c.args.includes("reset"))).toBe(true);
    expect(JSON.parse(await readFile(personalPath, "utf8"))).toHaveLength(1);
  });
  it("generates a timeline from the actual selected preset plan", async () => {
    const { supervisor } = setup();
    const op = supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();
    const operation = supervisor
      .status()
      .operations.find((o) => o.id === op.operationId);
    expect(operation?.state).toBe("passed");
    expect(operation?.phases.map((p) => p.id)).toEqual([
      "build",
      "start:a",
      "start:b",
    ]);
    expect(operation?.phases.every((p) => p.state === "passed")).toBe(true);
  });
  it("respects each preset member's explicit watch setting", async () => {
    const driver = new FakeDriver();
    const watchSource = vi.fn(() => () => undefined);
    const watchPath = temporaryWatchPath();
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      watchPath,
      watchPreferences: { b: false },
      driver,
      packages: [member("a"), member("b")],
      presets: [
        {
          ...preset,
          packages: [
            { name: "a", watch: false },
            { name: "b", watch: true },
          ],
        },
      ],
      watchSource,
    });

    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();

    expect(
      supervisor.status().packages.map(({ name, watch }) => ({ name, watch }))
    ).toEqual([
      { name: "a", watch: false },
      { name: "b", watch: true },
    ]);
    expect(watchSource).toHaveBeenCalledExactlyOnceWith(
      "/be/packages/b/src",
      expect.any(Function)
    );
    expect([...driver.children.keys()]).toEqual(["a", "b"]);
    expect(await readWatchPreferences(watchPath)).toEqual({
      a: false,
      b: true,
    });
  });
  it("persists every watch choice from concurrent preset starts", async () => {
    const watchPath = temporaryWatchPath();
    const { supervisor } = setup({ includeSeedPackages: true, watchPath });

    supervisor.action({ type: "preset.start", id: "pair" });
    await supervisor.idle();

    expect(supervisor.status().operations.at(-1)?.state).toBe("passed");
    expect(await readWatchPreferences(watchPath)).toEqual(
      Object.fromEntries(
        ["a", "b", ...seedPackages].map((name) => [name, false])
      )
    );
    expect(
      supervisor
        .status()
        .packages.filter((item) =>
          ["a", "b", ...seedPackages].includes(item.name)
        )
        .every((item) => !item.watch)
    ).toBe(true);
  });
});
