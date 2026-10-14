import { describe, expect, it } from "vitest";

import type { Command, Driver } from "../src/model/domain/models.js";

import { infrastructureServiceBuilder } from "../src/services/infrastructureService.js";
import { supervisorServiceBuilder } from "../src/services/supervisorService.js";

const refreshInventory = async (
  rows: Array<{
    ID?: string;
    Service: string;
    State: string;
    ExitCode?: number;
  }>,
  inspection: string | Error,
  services = rows.map((row) => row.Service)
) => {
  const commands: Command[] = [];
  const driver: Driver = {
    run: async (command) => {
      commands.push(command);
      if (command.args.includes("config")) return services.join("\n");
      if (command.args[0] === "inspect") {
        if (inspection instanceof Error) throw inspection;
        return inspection;
      }
      return JSON.stringify(rows);
    },
    start: async (command, log) => {
      commands.push(command);
      log(`${command.source} ready`);
      return { pid: 1, stop: async () => undefined };
    },
  };
  const supervisor = supervisorServiceBuilder({
    beRoot: "/be",
    driver,
    packages: [],
    presets: [],
  });
  const monitor = infrastructureServiceBuilder("/be", driver, supervisor);
  await monitor.refresh();
  await monitor.shutdown();
  return { supervisor, commands };
};

describe("compose inventory and log collection", () => {
  it.each([false, true])(
    "restarts an exited log tail for an unchanged container (exit during startup: %s)",
    async (exitDuringStartup) => {
      const exits: Array<(error: string) => void> = [];
      const stops: number[] = [];
      const row = { ID: "db1", Service: "db", State: "running" };
      const driver: Driver = {
        run: async (command) =>
          command.args.includes("config") ? "db" : JSON.stringify([row]),
        start: async (_command, log, exit) => {
          const pid = exits.push(exit);
          log(`INFO tail ${pid} ready`);
          if (exitDuringStartup && pid === 1) exit("Docker logs exited");
          return {
            pid,
            stop: async () => {
              stops.push(pid);
            },
          };
        },
      };
      const supervisor = supervisorServiceBuilder({
        beRoot: "/be",
        driver,
        packages: [],
        presets: [],
      });
      const monitor = infrastructureServiceBuilder("/be", driver, supervisor);
      await monitor.refresh();
      const before = supervisor.logs.read({});
      if (!exitDuringStartup) exits[0]("Docker logs exited");
      await monitor.refresh();

      expect(exits).toHaveLength(2);
      expect(stops).toEqual([1]);
      const delta = supervisor.logs.read({ cursors: before.cursors });
      expect(delta.resetSources).toEqual(["infra:db"]);
      expect(delta.entries.map((entry) => entry.message)).toEqual([
        "INFO tail 2 ready",
      ]);

      exits[0]("Late exit from the original tail");
      await monitor.refresh();
      expect(exits).toHaveLength(2);
      expect(stops).toEqual([1]);

      exits[1]("Replacement tail exited");
      await monitor.refresh();
      expect(exits).toHaveLength(3);
      expect(stops).toEqual([1, 2]);
      await monitor.shutdown();
      expect(stops).toEqual([1, 2, 3]);
    }
  );

  it("reuses unchanged tails, rotates changed containers and removes missing tails in order", async () => {
    let rows = [
      { ID: "first", Service: "db", State: "running" },
      { ID: "second", Service: "cache", State: "running" },
    ];
    const events: string[] = [];
    const driver: Driver = {
      run: async (command) =>
        command.args.includes("config") ? "db\ncache" : JSON.stringify(rows),
      start: async (command, log) => {
        const service = command.args.at(-1);
        events.push(`start:${service}`);
        log(`INFO ${service} started`);
        return {
          pid: 1,
          stop: async () => {
            events.push(`stop:${service}`);
          },
        };
      },
    };
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: [],
      presets: [],
    });
    const monitor = infrastructureServiceBuilder("/be", driver, supervisor);
    await monitor.refresh();
    const before = supervisor.logs.read({});
    await monitor.refresh();
    expect(events).toEqual(["start:db", "start:cache"]);

    rows = [{ ID: "replacement", Service: "db", State: "running" }];
    await monitor.refresh();
    expect(events).toEqual([
      "start:db",
      "start:cache",
      "stop:db",
      "start:db",
      "stop:cache",
    ]);
    const delta = supervisor.logs.read({ cursors: before.cursors });
    expect(delta.resetSources).toEqual(["infra:db"]);
    expect(delta.entries.map((entry) => entry.message)).toEqual([
      "INFO db started",
    ]);
    await monitor.shutdown();
    await monitor.refresh();
    expect(events.at(-1)).toBe("stop:db");
    expect(events).toHaveLength(6);
  });

  it("includes every infrastructure service and completed init containers but excludes the dashboard", async () => {
    const commands: Command[] = [];
    const driver: Driver = {
      run: async (command) => {
        commands.push(command);
        return command.args.includes("config")
          ? "db\nmock\nseed\ndevelopment-dashboard\n"
          : JSON.stringify([
              { ID: "db1", Service: "db", State: "running", Status: "Up" },
              {
                ID: "seed1",
                Service: "seed",
                State: "exited",
                ExitCode: 0,
                Status: "Exited (0)",
              },
            ]);
      },
      start: async (command, log) => {
        commands.push(command);
        log(`${command.source} ready`);
        return { pid: 1, stop: async () => undefined };
      },
    };
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      driver,
      packages: [],
      presets: [],
    });
    const monitor = infrastructureServiceBuilder("/be", driver, supervisor);
    await monitor.refresh();
    expect(supervisor.status().infrastructure.map((s) => s.name)).toEqual([
      "db",
      "mock",
      "seed",
    ]);
    expect(
      supervisor.status().infrastructure.find((s) => s.name === "mock")?.state
    ).toBe("stopped");
    expect(supervisor.logs.read({}).entries.map((e) => e.source)).toEqual([
      "infra:db",
      "infra:seed",
    ]);
    expect(
      commands.every((c) => c.args.includes("/be/docker/docker-compose.yml"))
    ).toBe(true);
    await monitor.shutdown();
  });

  it("recognizes manual signal stops while preserving failed and active container states", async () => {
    const rows = [
      { ID: "connect", Service: "connect", State: "exited", ExitCode: 143 },
      {
        ID: "abcdef123456",
        Service: "selfcare",
        State: "exited",
        ExitCode: 137,
      },
      { ID: "oom", Service: "oom", State: "exited", ExitCode: 137 },
      {
        ID: "engine-error",
        Service: "engine-error",
        State: "exited",
        ExitCode: 137,
      },
      {
        ID: "term-error",
        Service: "term-error",
        State: "exited",
        ExitCode: 143,
      },
      { ID: "term-oom", Service: "term-oom", State: "exited", ExitCode: 143 },
      { ID: "dead", Service: "dead", State: "dead", ExitCode: 143 },
      { ID: "local-kms", Service: "local-kms", State: "exited", ExitCode: 2 },
      { ID: "failure", Service: "failure", State: "exited", ExitCode: 1 },
      { ID: "db", Service: "db", State: "running", ExitCode: 137 },
      { ID: "created", Service: "created", State: "created", ExitCode: 137 },
      { ID: "restart", Service: "restart", State: "restarting", ExitCode: 143 },
      { ID: "seed", Service: "seed", State: "exited", ExitCode: 0 },
    ];
    const { supervisor, commands } = await refreshInventory(
      rows,
      [
        { ID: "connect", OOMKilled: false, Error: "" },
        { ID: "abcdef1234567890", OOMKilled: false, Error: "" },
        { ID: "oom", OOMKilled: true, Error: "" },
        { ID: "engine-error", OOMKilled: false, Error: "engine failure" },
        { ID: "term-error", Error: "engine failure" },
        { ID: "term-oom", OOMKilled: true, Error: "" },
      ]
        .map((state) => JSON.stringify(state))
        .join("\n") + "\ninvalid-json",
      [...rows.map((row) => row.Service), "missing"]
    );
    expect(
      supervisor.status().infrastructure.map(({ name, state }) => [name, state])
    ).toEqual([
      ["connect", "stopped"],
      ["selfcare", "stopped"],
      ["oom", "failed"],
      ["engine-error", "failed"],
      ["term-error", "failed"],
      ["term-oom", "failed"],
      ["dead", "failed"],
      ["local-kms", "failed"],
      ["failure", "failed"],
      ["db", "running"],
      ["created", "starting"],
      ["restart", "starting"],
      ["seed", "stopped"],
      ["missing", "stopped"],
    ]);
    expect(
      supervisor.status().infrastructure.find(({ name }) => name === "selfcare")
        ?.exitCode
    ).toBe(137);
    const inspections = commands.filter(
      (command) => command.args[0] === "inspect"
    );
    expect(inspections).toEqual([
      {
        source: "orchestration",
        executable: "docker",
        args: [
          "inspect",
          "--format",
          '{"ID":{{json .Id}},"OOMKilled":{{json .State.OOMKilled}},"Error":{{json .State.Error}}}',
          "connect",
          "abcdef123456",
          "oom",
          "engine-error",
          "term-error",
          "term-oom",
        ],
        cwd: "/be",
        timeoutMs: 15_000,
      },
    ]);
    expect(
      supervisor.logs.read({}).entries.map((entry) => entry.source)
    ).toEqual(rows.map((row) => `infra:${row.Service}`));
  });

  it.each([
    ["missing inspection", ""],
    ["invalid JSON", "not-json"],
    ["missing state fields", '{"ID":"selfcare"}'],
    [
      "invalid state fields",
      '{"ID":"selfcare","OOMKilled":"false","Error":""}',
    ],
    ["different container", '{"ID":"other","OOMKilled":false,"Error":""}'],
    ["failed inspection", new Error("Docker inspect failed")],
  ])(
    "keeps ambiguous SIGKILL failures and log tails on %s",
    async (_label, inspection) => {
      const { supervisor, commands } = await refreshInventory(
        [
          {
            ID: "selfcare",
            Service: "selfcare",
            State: "exited",
            ExitCode: 137,
          },
          { ID: "connect", Service: "connect", State: "exited", ExitCode: 143 },
          { ID: "db", Service: "db", State: "running" },
        ],
        inspection
      );
      expect(
        supervisor
          .status()
          .infrastructure.map(({ name, state }) => [name, state])
      ).toEqual([
        ["selfcare", "failed"],
        ["connect", "stopped"],
        ["db", "running"],
      ]);
      expect(
        commands
          .filter((command) => command.args.includes("logs"))
          .map((command) => command.source)
      ).toEqual(["infra:selfcare", "infra:connect", "infra:db"]);
    }
  );

  it("uses a service identifier fallback when inventory has no container ID", async () => {
    const { supervisor, commands } = await refreshInventory(
      [{ Service: "selfcare", State: "exited", ExitCode: 137 }],
      '{"ID":"selfcare","OOMKilled":false,"Error":""}'
    );
    expect(supervisor.status().infrastructure).toEqual([
      { name: "selfcare", state: "stopped", exitCode: 137 },
    ]);
    expect(
      commands.find((command) => command.args[0] === "inspect")?.args.at(-1)
    ).toBe("selfcare");
  });

  it("does not accept an ambiguous container ID prefix as successful inspection", async () => {
    const { supervisor } = await refreshInventory(
      [
        {
          ID: "abcdef123456",
          Service: "selfcare",
          State: "exited",
          ExitCode: 137,
        },
      ],
      [
        { ID: "abcdef123456aaaa", OOMKilled: false, Error: "" },
        { ID: "abcdef123456bbbb", OOMKilled: false, Error: "" },
      ]
        .map((state) => JSON.stringify(state))
        .join("\n")
    );
    expect(supervisor.status().infrastructure[0]?.state).toBe("failed");
  });
});
