import type { ConsumerGroupState, GroupDescriptions } from "kafkajs";

import { AssignerProtocol } from "kafkajs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Driver, ProcessExit } from "../src/model/domain/models.js";
import type { Supervisor } from "../src/services/supervisorService.js";

import { DASHBOARD_TIMING, SEED_PACKAGES } from "../src/config/constants.js";
import { supervisorServiceBuilder } from "../src/services/supervisorService.js";

const { admin, constructKafka } = vi.hoisted(() => ({
  admin: {
    connect: vi.fn<() => Promise<void>>(),
    describeGroups: vi.fn<() => Promise<GroupDescriptions>>(),
    disconnect: vi.fn<() => Promise<void>>(),
  },
  constructKafka: vi.fn(),
}));

vi.mock("kafkajs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("kafkajs")>()),
  Kafka: constructKafka,
}));

const consumer = "pagopa-interop-tenant-readmodel-writer-sql";
const environment = {
  KAFKA_GROUP_ID: "tenant-group",
  KAFKA_CLIENT_ID: "tenant-writer",
  KAFKA_BROKERS: "localhost:9092",
  KAFKA_DISABLE_AWS_IAM_AUTH: "true",
  TOPIC_STARTING_OFFSET: "latest",
};
const supervisors: Supervisor[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  constructKafka.mockImplementation(function () {
    return { admin: () => admin };
  });
  admin.connect.mockResolvedValue(undefined);
  admin.disconnect.mockResolvedValue(undefined);
  admin.describeGroups.mockResolvedValue({ groups: [] });
});

afterEach(async () => {
  await Promise.all(
    supervisors.splice(0).map((supervisor) => supervisor.shutdown())
  );
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(overrides: NodeJS.ProcessEnv = {}, seed = false) {
  let launchedEnvironment: NodeJS.ProcessEnv = {};
  let exit = (_result: ProcessExit): void => undefined;
  const stop = vi.fn(async () => undefined);
  const run = vi.fn<Driver["run"]>().mockResolvedValue("");
  const start = vi
    .fn<Driver["start"]>()
    .mockImplementation(async (command, _log, onExit) => {
      if (command.source === consumer) {
        launchedEnvironment = command.env ?? {};
        exit = onExit;
      }
      return { pid: 42, stop };
    });
  const names = seed ? SEED_PACKAGES : [consumer];
  const supervisor = supervisorServiceBuilder({
    beRoot: "/be",
    driver: { run, start },
    packages: names.map((name) => ({
      name,
      label: name,
      kind: "worker",
      state: "stopped",
      watch: true,
    })),
    presets: seed
      ? [
          {
            id: "seed",
            name: "Seed",
            source: "shared",
            packages: names.map((name) => ({ name })),
          },
        ]
      : [],
    environment: async (name) =>
      name === consumer ? { ...environment, ...overrides } : {},
  });
  supervisors.push(supervisor);
  return {
    supervisor,
    run,
    start,
    stop,
    environment: () => launchedEnvironment,
    exit: () => exit({ code: 1, signal: null }),
  };
}

function group(
  clientId: string,
  changes: {
    groupId?: string;
    state?: ConsumerGroupState;
    assignment?: Buffer;
  } = {}
): GroupDescriptions {
  return {
    groups: [
      {
        groupId: changes.groupId ?? environment.KAFKA_GROUP_ID,
        state: changes.state ?? "Stable",
        protocolType: "consumer",
        protocol: "roundrobin",
        members: [
          {
            memberId: "member",
            clientId,
            clientHost: "127.0.0.1",
            memberMetadata: Buffer.alloc(0),
            memberAssignment:
              changes.assignment ??
              AssignerProtocol.MemberAssignment.encode({
                version: 0,
                assignment: { tenants: [0] },
                userData: Buffer.alloc(0),
              }),
          },
        ],
      },
    ],
  };
}

describe("managed Kafka consumer readiness", () => {
  it("reserves effective ports before concurrent driver starts finish", async () => {
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const start = vi.fn<Driver["start"]>().mockImplementation(async () => {
      await gate;
      return { pid: 42, stop: async () => undefined };
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const supervisor = supervisorServiceBuilder({
      beRoot: "/be",
      packages: ["one", "two"].map((name) => ({
        name,
        label: name,
        kind: "service",
        port: 5000,
        state: "stopped",
        watch: true,
      })),
      presets: [],
      driver: { run: async () => "", start },
      environment: async () => ({ PORT: "5000" }),
    });
    supervisors.push(supervisor);
    supervisor.action({ type: "packages.start", names: ["one", "two"] });
    try {
      await vi.waitFor(() =>
        expect(supervisor.status().operations[0].phases[2].state).toBe("failed")
      );
    } finally {
      release();
      await supervisor.idle();
    }
    expect(start).toHaveBeenCalledOnce();
    expect(supervisor.status().operations[0]).toMatchObject({
      state: "failed",
      error: expect.stringContaining("port 5000"),
    });
    expect(supervisor.status().packages[0].state).toBe("running");
  });

  it("uses a new launch identity and earliest for fresh local groups before confirming readiness", async () => {
    const test = setup();
    admin.describeGroups.mockImplementation(async () =>
      group(test.environment().KAFKA_CLIENT_ID ?? "")
    );
    test.supervisor.action({ type: "package.start", name: consumer });
    await test.supervisor.idle();
    expect(test.environment()).toMatchObject({
      KAFKA_GROUP_ID: "tenant-group",
      TOPIC_STARTING_OFFSET: "earliest",
    });
    expect(test.environment().KAFKA_CLIENT_ID).not.toBe(
      environment.KAFKA_CLIENT_ID
    );
    expect(admin.describeGroups).toHaveBeenCalledWith(["tenant-group"]);
    expect(admin.disconnect).toHaveBeenCalledOnce();
    expect(test.supervisor.status().packages[0].state).toBe("running");
  });

  it.each([
    { groupId: "another-group" },
    { state: "PreparingRebalance" },
    { clientId: "old-launch" },
    {
      assignment: AssignerProtocol.MemberAssignment.encode({
        version: 0,
        assignment: { tenants: [] },
        userData: Buffer.alloc(0),
      }),
    },
    { assignment: Buffer.from([1]) },
  ] satisfies Array<{
    groupId?: string;
    state?: ConsumerGroupState;
    clientId?: string;
    assignment?: Buffer;
  }>)(
    "waits for this launch's stable assigned member (%j)",
    async ({ clientId, ...changes }) => {
      const test = setup();
      let ready = false;
      admin.describeGroups.mockImplementation(async () =>
        group(
          ready
            ? (test.environment().KAFKA_CLIENT_ID ?? "")
            : (clientId ?? test.environment().KAFKA_CLIENT_ID ?? ""),
          ready ? {} : changes
        )
      );
      test.supervisor.action({ type: "package.start", name: consumer });
      await vi.waitFor(() => expect(admin.describeGroups).toHaveBeenCalled());
      expect(test.supervisor.status().packages[0].state).toBe("starting");
      ready = true;
      await test.supervisor.idle();
      expect(test.supervisor.status().packages[0].state).toBe("running");
      expect(admin.disconnect).toHaveBeenCalledOnce();
    }
  );

  it("keeps seed queued until the Kafka consumer has joined and received partitions", async () => {
    const test = setup({}, true);
    let ready = false;
    admin.describeGroups.mockImplementation(async () =>
      ready ? group(test.environment().KAFKA_CLIENT_ID ?? "") : { groups: [] }
    );
    test.supervisor.action({ type: "preset.start", id: "seed" });
    test.supervisor.action({ type: "seed" });
    await vi.waitFor(() => expect(admin.describeGroups).toHaveBeenCalled());
    expect(
      test.run.mock.calls.some(([command]) => command.args.includes("seed"))
    ).toBe(false);
    ready = true;
    await test.supervisor.idle();
    expect(
      test.run.mock.calls.filter(([command]) => command.args.includes("seed"))
    ).toHaveLength(1);
  });

  it("fails readiness and disconnects the observer if the consumer exits", async () => {
    const test = setup();
    test.supervisor.action({ type: "package.start", name: consumer });
    await vi.waitFor(() => expect(admin.describeGroups).toHaveBeenCalled());
    test.exit();
    await test.supervisor.idle();
    expect(test.supervisor.status().operations[0]).toMatchObject({
      state: "failed",
      error: expect.stringContaining("exited"),
    });
    expect(admin.disconnect).toHaveBeenCalledOnce();
  });

  it("times out an unready consumer and stops it before finishing the operation", async () => {
    const test = setup({}, true);
    test.supervisor.action({ type: "preset.start", id: "seed" });
    test.supervisor.action({ type: "seed" });
    await vi.waitFor(() => expect(admin.describeGroups).toHaveBeenCalled());
    vi.spyOn(Date, "now").mockReturnValue(
      Date.now() + DASHBOARD_TIMING.readinessTimeoutMs + 1
    );
    await test.supervisor.idle();
    expect(test.supervisor.status().operations[0]).toMatchObject({
      state: "failed",
      error: expect.stringContaining("timed out"),
    });
    expect(test.stop).toHaveBeenCalledOnce();
    expect(admin.disconnect).toHaveBeenCalledOnce();
    expect(
      test.run.mock.calls.some(([command]) => command.args.includes("seed"))
    ).toBe(false);
  });

  it("waits through a temporary coordinator failure", async () => {
    const test = setup();
    admin.describeGroups.mockRejectedValueOnce(
      new Error("Coordinator is loading")
    );
    admin.describeGroups.mockImplementation(async () =>
      group(test.environment().KAFKA_CLIENT_ID ?? "")
    );
    test.supervisor.action({ type: "package.start", name: consumer });
    await test.supervisor.idle();
    expect(admin.describeGroups).toHaveBeenCalledTimes(2);
    expect(test.supervisor.status().operations[0].state).toBe("passed");
  });

  it("cancels consumer readiness when the dashboard shuts down", async () => {
    const test = setup();
    test.supervisor.action({ type: "package.start", name: consumer });
    await vi.waitFor(() => expect(admin.describeGroups).toHaveBeenCalled());
    await test.supervisor.shutdown();
    expect(test.supervisor.status().operations[0].state).toBe("failed");
    expect(test.stop).toHaveBeenCalledOnce();
    expect(admin.disconnect).toHaveBeenCalledOnce();
  });

  it.each([
    { KAFKA_BROKERS: "remote.example:9092" },
    { KAFKA_BROKERS: "localhost:9092,remote.example:9092" },
    { KAFKA_BROKERS: "user:password@localhost:9092" },
    { KAFKA_DISABLE_AWS_IAM_AUTH: undefined },
    { KAFKA_BROKER_CONNECTION_STRING: "external-auth" },
  ])(
    "rejects nonlocal consumer configuration before creating a client (%j)",
    async (overrides) => {
      const test = setup(overrides);
      test.supervisor.action({ type: "package.start", name: consumer });
      await test.supervisor.idle();
      expect(test.supervisor.status().operations[0].state).toBe("failed");
      expect(constructKafka).not.toHaveBeenCalled();
      expect(test.start).not.toHaveBeenCalled();
    }
  );
});
