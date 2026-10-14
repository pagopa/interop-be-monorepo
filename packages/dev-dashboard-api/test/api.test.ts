import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  schemas,
  type Package,
  type Preset,
} from "pagopa-interop-dev-dashboard-contracts";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Driver } from "../src/model/domain/models.js";

import { createApp } from "../src/app.js";
import { supervisorServiceBuilder } from "../src/services/supervisorService.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  );
});

const setup = (extraPackages: Package[] = [], presets: Preset[] = []) => {
  const watchRoot = join(tmpdir(), `dashboard-api-watch-${randomUUID()}`);
  directories.push(watchRoot);
  const driver: Driver = {
    run: async () => "",
    start: async () => ({ pid: 1, stop: async () => undefined }),
  };
  const supervisor = supervisorServiceBuilder({
    beRoot: "/be",
    watchPath: join(watchRoot, "watch.json"),
    packages: [
      {
        name: "a",
        label: "A",
        kind: "worker",
        state: "stopped",
        watch: true,
      },
      ...extraPackages,
    ],
    presets,
    driver,
  });
  const app = createApp(supervisor, {
    identities: async () => ({ ready: false, tenants: [] }),
    identity: async () => ({ sessionToken: "token" }),
  });
  return { app, supervisor, driver };
};
describe("dashboard HTTP boundary", () => {
  it.each(["fullstack.start", "fullstack.stop", "frontend.restart"])(
    "rejects removed frontend control %s without an operation",
    async (type) => {
      const { app, supervisor, driver } = setup();
      const run = vi.spyOn(driver, "run");
      const response = await request(app)
        .post("/__local-dashboard/api/actions")
        .send({
          type,
          ...(type === "frontend.restart" ? { mode: "local" } : {}),
        });
      expect(response.status).toBe(400);
      expect(supervisor.status().operations).toEqual([]);
      expect(run).not.toHaveBeenCalled();
    }
  );

  it.each(["seed", "fullstack"])(
    "rejects obsolete preset input flag %s",
    async (flag) => {
      const { app, supervisor } = setup();
      const response = await request(app)
        .post("/__local-dashboard/api/presets")
        .send({ name: "Mine", packages: [{ name: "a" }], [flag]: false });
      expect(response.status).toBe(400);
      expect(supervisor.status().presets).toEqual([]);
    }
  );
  it("returns dashboard status without frontend runtime or global mode", async () => {
    const { app } = setup();
    const response = await request(app).get("/__local-dashboard/api/status");

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("mode");
    expect(response.body).not.toHaveProperty("frontendAvailable");
  });

  it.each([
    { group: "group:packages", members: ["a", "b"] },
    { group: "group:infra", members: ["infra:postgres", "infra:retired"] },
  ])(
    "aggregates $group before filtering and pagination with isolated cursors and resets",
    async ({ group, members }) => {
      const { app, supervisor } = setup([
        {
          name: "b",
          label: "B",
          kind: "worker",
          state: "stopped",
          watch: true,
        },
      ]);
      supervisor.setInfrastructure([{ name: "postgres", state: "stopped" }]);
      supervisor.logs.append(
        members[0],
        "ERROR aggregate failure cid=aggregate-42"
      );
      supervisor.logs.append(members[1], "INFO aggregate ready");
      const excluded = [
        "orchestration",
        "frontend",
        "checks",
        "outside",
        ...(group === "group:packages"
          ? ["infra:postgres", "infra:retired"]
          : ["a", "b"]),
      ];
      for (let index = 0; index < 600; index++)
        supervisor.logs.append(
          excluded[index % excluded.length],
          `ERROR unrelated ${index}`
        );
      const read = async (query: Record<string, string | number> = {}) => {
        const response = await request(app)
          .get("/__local-dashboard/api/logs")
          .query({ source: group, ...query });
        expect(response.status).toBe(200);
        return schemas.LogsResponse.parse(response.body);
      };
      const first = await read({ limit: 500 });
      expect(first.entries.map(({ source }) => source)).toEqual(members);
      expect(Object.keys(first.cursors).sort()).toEqual([...members].sort());
      const filtered = await read({ level: "error", search: "AGGREGATE-42" });
      expect(filtered.entries.map(({ source }) => source)).toEqual([
        members[0],
      ]);
      expect((await read({ level: "debug" })).entries).toEqual([]);
      supervisor.logs.append(members[1], "INFO next aggregate member");
      supervisor.logs.append("orchestration", "ERROR unrelated next");
      supervisor.logs.append(members[0], "ERROR next aggregate member");
      const next = await read({
        cursors: JSON.stringify({
          ...first.cursors,
          orchestration: "obsolete:1",
        }),
        limit: 1,
      });
      expect(next.entries.map(({ source }) => source)).toEqual([members[1]]);
      expect(Object.keys(next.cursors).sort()).toEqual([...members].sort());
      const last = await read({
        cursors: JSON.stringify(next.cursors),
        limit: 1,
      });
      expect(last.entries.map(({ source }) => source)).toEqual([members[0]]);
      supervisor.logs.reset(members[1]);
      supervisor.logs.append(members[1], "ERROR restarted aggregate member");
      const reset = await read({ cursors: JSON.stringify(last.cursors) });
      expect(reset.resetSources).toEqual([members[1]]);
      expect(reset.entries.map(({ message }) => message)).toEqual([
        "ERROR restarted aggregate member",
      ]);
    }
  );

  it.each([
    { group: "group:packages", source: "a" },
    { group: "group:infra", source: "infra:retired" },
  ])(
    "returns the latest 500 $group lines and an empty result without falling back to unrelated buffers",
    async ({ group, source }) => {
      const { app, supervisor } = setup();
      supervisor.logs.append("orchestration", "ERROR excluded");
      const empty = await request(app)
        .get("/__local-dashboard/api/logs")
        .query({
          source: group,
          cursors: JSON.stringify({ orchestration: "old:1" }),
        });
      expect(schemas.LogsResponse.parse(empty.body)).toEqual({
        entries: [],
        cursors: {},
        resetSources: [],
      });
      for (let index = 1; index <= 600; index++) {
        supervisor.logs.append(source, `INFO matching ${index}`);
        supervisor.logs.append("frontend", `ERROR excluded ${index}`);
      }
      const response = await request(app)
        .get("/__local-dashboard/api/logs")
        .query({
          source: group,
          limit: 500,
          cursors: JSON.stringify({ orchestration: "obsolete:1" }),
        });
      const logs = schemas.LogsResponse.parse(response.body);
      expect(logs.entries).toHaveLength(500);
      expect(logs.entries[0]?.message).toBe("INFO matching 101");
      expect(logs.entries.at(-1)?.message).toBe("INFO matching 600");
      expect(new Set(logs.entries.map((entry) => entry.source))).toEqual(
        new Set([source])
      );
      expect(Object.keys(logs.cursors)).toEqual([source]);
    }
  );
  it("accepts seed package startup with a pollable operation and a stable complete group", async () => {
    const seedPackages = [
      "pagopa-interop-tenant-process",
      "pagopa-interop-tenant-readmodel-writer-sql",
      "pagopa-interop-catalog-process",
      "pagopa-interop-catalog-readmodel-writer-sql",
    ];
    const { app, supervisor } = setup(
      seedPackages.map((name) => ({
        name,
        label: name,
        kind: "worker",
        state: "stopped",
        watch: true,
      }))
    );
    const before = schemas.DashboardStatus.parse(
      (await request(app).get("/__local-dashboard/api/status")).body
    );
    expect(before.seedPackages).toEqual(seedPackages);
    expect(before.seedPrerequisites).toEqual(seedPackages);
    const response = await request(app)
      .post("/__local-dashboard/api/actions")
      .send({ type: "seed.prepare" });
    expect(response.status).toBe(202);
    const accepted = schemas.OperationAccepted.parse(response.body);
    await supervisor.idle();
    const status = schemas.DashboardStatus.parse(
      (await request(app).get("/__local-dashboard/api/status")).body
    );
    expect(
      status.operations.find(
        (operation) => operation.id === accepted.operationId
      )
    ).toMatchObject({ kind: "seed.prepare", state: "passed" });
    expect(status.seedPackages).toEqual(seedPackages);
    expect(status.seedPrerequisites).toEqual([]);
  });
  it.each([
    { name: "pagopa-interop-tenant-process" },
    { names: ["pagopa-interop-tenant-process"] },
    { watch: true },
    { confirm: true },
    { unknown: "field" },
  ])("rejects extra seed preparation fields: %j", async (extra) => {
    const { app, supervisor, driver } = setup();
    const run = vi.spyOn(driver, "run");
    const start = vi.spyOn(driver, "start");
    const response = await request(app)
      .post("/__local-dashboard/api/actions")
      .send({ type: "seed.prepare", ...extra });
    expect(response.status).toBe(400);
    expect(supervisor.status().operations).toEqual([]);
    expect(run).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
  it("aggregates preset members before pagination and retains independent incremental cursors", async () => {
    const { app, supervisor } = setup(
      [
        {
          name: "b",
          label: "B",
          kind: "worker",
          state: "stopped",
          watch: true,
        },
      ],
      [
        {
          id: "core",
          name: "Core",
          source: "shared",
          packages: [{ name: "a" }, { name: "b" }],
        },
      ]
    );
    supervisor.logs.append("a", "ERROR member failure");
    supervisor.logs.append("b", "INFO member ready");
    supervisor.logs.append("orchestration", "ERROR startup failed");
    for (let index = 0; index < 600; index++)
      supervisor.logs.append("outside", `ERROR unrelated ${index}`);
    const read = async (query: Record<string, string | number>) => {
      const response = await request(app)
        .get("/__local-dashboard/api/logs")
        .query({ source: "preset:core", ...query });
      expect(response.status).toBe(200);
      return schemas.LogsResponse.parse(response.body);
    };
    const first = await read({ limit: 500 });
    expect(first.entries.map((entry) => entry.message)).toEqual([
      "ERROR member failure",
      "INFO member ready",
      "ERROR startup failed",
    ]);
    expect(Object.keys(first.cursors).sort()).toEqual([
      "a",
      "b",
      "orchestration",
    ]);
    expect(
      (
        await read({ level: "error", service: "a", search: "member" })
      ).entries.map((entry) => entry.source)
    ).toEqual(["a"]);
    supervisor.logs.append("b", "INFO new b");
    supervisor.logs.append("outside", "ERROR unrelated new");
    supervisor.logs.append("a", "ERROR new a");
    const next = await read({
      cursors: JSON.stringify(first.cursors),
      limit: 1,
    });
    expect(next.entries.map((entry) => entry.message)).toEqual(["INFO new b"]);
    const last = await read({
      cursors: JSON.stringify(next.cursors),
      limit: 1,
    });
    expect(last.entries.map((entry) => entry.message)).toEqual(["ERROR new a"]);
    supervisor.logs.reset("a");
    supervisor.logs.append("a", "ERROR after restart");
    const reset = await read({ cursors: JSON.stringify(last.cursors) });
    expect(reset.resetSources).toEqual(["a"]);
    expect(reset.entries.map((entry) => entry.message)).toEqual([
      "ERROR after restart",
    ]);
  });
  it("aggregates seed package logs and orchestration before filtering and pagination without unrelated sources", async () => {
    const { app, supervisor } = setup();
    const seedPackages = supervisor.status().seedPackages;
    seedPackages.forEach((name, index) =>
      supervisor.logs.append(
        name,
        `${index ? "INFO" : "ERROR"} seed member cid=seed-cid`
      )
    );
    supervisor.logs.append("orchestration", "ERROR seed build failed");
    const unrelated = ["a", "outside", "infra:postgres", "frontend", "checks"];
    for (let index = 0; index < 600; index++)
      supervisor.logs.append(
        unrelated[index % unrelated.length],
        `ERROR unrelated ${index}`
      );
    const read = async (query: Record<string, string | number> = {}) => {
      const response = await request(app)
        .get("/__local-dashboard/api/logs")
        .query({ source: "group:seed", ...query });
      expect(response.status).toBe(200);
      return schemas.LogsResponse.parse(response.body);
    };
    const first = await read({ limit: 500 });
    expect(first.entries.map((entry) => entry.source)).toEqual([
      ...seedPackages,
      "orchestration",
    ]);
    expect(Object.keys(first.cursors).sort()).toEqual(
      [...seedPackages, "orchestration"].sort()
    );
    expect(
      (
        await read({
          level: "error",
          service: seedPackages[0],
          search: "member",
          cid: "seed-cid",
        })
      ).entries.map((entry) => entry.source)
    ).toEqual([seedPackages[0]]);
    expect((await read({ service: "frontend" })).entries).toEqual([]);
    supervisor.logs.append(seedPackages[1], "INFO new seed member");
    supervisor.logs.append("infra:postgres", "ERROR unrelated infrastructure");
    supervisor.logs.append("orchestration", "ERROR new seed diagnostics");
    const next = await read({
      cursors: JSON.stringify({ ...first.cursors, frontend: "obsolete:1" }),
      limit: 1,
    });
    expect(next.entries.map((entry) => entry.source)).toEqual([
      seedPackages[1],
    ]);
    expect(next.cursors).not.toHaveProperty("frontend");
    const last = await read({
      cursors: JSON.stringify(next.cursors),
      limit: 1,
    });
    expect(last.entries.map((entry) => entry.source)).toEqual([
      "orchestration",
    ]);
    supervisor.logs.reset(seedPackages[0]);
    supervisor.logs.append(seedPackages[0], "ERROR restarted seed member");
    const reset = await read({ cursors: JSON.stringify(last.cursors) });
    expect(reset.resetSources).toEqual([seedPackages[0]]);
    expect(reset.entries.map((entry) => entry.message)).toEqual([
      "ERROR restarted seed member",
    ]);
  });
  it("keeps preset log groups restricted to backend members and orchestration", async () => {
    const { app, supervisor } = setup(
      [],
      [
        {
          id: "be",
          name: "Backend",
          source: "personal",
          packages: [{ name: "a" }],
        },
        {
          id: "full",
          name: "Fullstack",
          source: "shared",
          packages: [{ name: "a" }],
        },
      ]
    );
    for (const source of [
      "a",
      "frontend",
      "checks",
      "orchestration",
      "outside",
    ])
      supervisor.logs.append(source, `ERROR ${source}`);
    const read = async (id: string) =>
      schemas.LogsResponse.parse(
        (
          await request(app)
            .get("/__local-dashboard/api/logs")
            .query({ source: `preset:${id}` })
        ).body
      );
    expect((await read("be")).entries.map((entry) => entry.source)).toEqual([
      "a",
      "orchestration",
    ]);
    expect((await read("full")).entries.map((entry) => entry.source)).toEqual([
      "a",
      "orchestration",
    ]);
  });
  it("does not fall back to all logs for unknown or empty presets", async () => {
    const { app, supervisor } = setup(
      [],
      [
        {
          id: "empty",
          name: "Empty",
          source: "shared",
          packages: [],
        },
      ]
    );
    supervisor.logs.append("a", "ERROR unrelated");
    supervisor.logs.append("orchestration", "ERROR unrelated startup");
    const missing = await request(app)
      .get("/__local-dashboard/api/logs")
      .query({ source: "preset:missing" });
    expect(missing.status).toBe(400);
    expect(schemas.ApiError.parse(missing.body).error).toContain(
      "Unknown preset"
    );
    const empty = await request(app)
      .get("/__local-dashboard/api/logs")
      .query({
        source: "preset:empty",
        cursors: JSON.stringify({ a: "obsolete:1" }),
      });
    expect(empty.status).toBe(200);
    expect(schemas.LogsResponse.parse(empty.body)).toEqual({
      entries: [],
      cursors: {},
      resetSources: [],
    });
  });
  it("keeps a partially failed bulk operation running while a later row is still starting", async () => {
    const { app, supervisor, driver } = setup([
      { name: "b", label: "B", kind: "worker", state: "stopped", watch: true },
    ]);
    let finishStart: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      finishStart = resolve;
    });
    vi.spyOn(driver, "start").mockImplementation(async (command) => {
      if (command.source === "a") throw new Error("a startup failed");
      await gate;
      return { pid: 2, stop: async () => undefined };
    });
    const response = await request(app)
      .post("/__local-dashboard/api/actions")
      .send({ type: "packages.start", names: ["a", "b"] });
    const accepted = schemas.OperationAccepted.parse(response.body);
    try {
      await vi.waitFor(() =>
        expect(
          supervisor.status().packages.find((item) => item.name === "b")?.state
        ).toBe("starting")
      );
      const status = schemas.DashboardStatus.parse(
        (await request(app).get("/__local-dashboard/api/status")).body
      );
      expect(
        status.operations.find(
          (operation) => operation.id === accepted.operationId
        )
      ).toMatchObject({
        state: "running",
        phases: [
          { id: "build", state: "passed" },
          { id: "start:a", state: "failed" },
          { id: "start:b", state: "running" },
        ],
      });
    } finally {
      finishStart();
    }
    await supervisor.idle();
    expect(supervisor.status().operations.at(-1)).toMatchObject({
      state: "failed",
      phases: [{ state: "passed" }, { state: "failed" }, { state: "passed" }],
    });
  });
  it.each(["packages.start", "packages.stop", "packages.watch"])(
    "rejects an empty selection for %s",
    async (type) => {
      const { app, supervisor } = setup();
      const response = await request(app)
        .post("/__local-dashboard/api/actions")
        .send({
          type,
          names: [],
          ...(type === "packages.watch" ? { watch: false } : {}),
        });
      expect(response.status).toBe(400);
      expect(supervisor.status().operations).toEqual([]);
    }
  );
  it("accepts bulk actions through the existing endpoint with pollable per-package phases", async () => {
    const { app, supervisor } = setup();
    for (const action of [
      { type: "packages.start", names: ["a"] },
      { type: "packages.watch", names: ["a"], watch: false },
      { type: "packages.stop", names: ["a"] },
    ]) {
      const response = await request(app)
        .post("/__local-dashboard/api/actions")
        .send(action);
      expect(response.status).toBe(202);
      const accepted = schemas.OperationAccepted.parse(response.body);
      await supervisor.idle();
      const status = schemas.DashboardStatus.parse(
        (await request(app).get("/__local-dashboard/api/status")).body
      );
      expect(
        status.operations.find(
          (operation) => operation.id === accepted.operationId
        )
      ).toMatchObject({ kind: action.type, state: "passed" });
    }
    expect(supervisor.status().packages[0]).toMatchObject({
      state: "stopped",
      watch: false,
    });
  });
  it("rejects the removed prerequisite startup action without running an operation", async () => {
    const { app, supervisor } = setup();
    const response = await request(app)
      .post("/__local-dashboard/api/actions")
      .send({ type: "package.start-with-prerequisites", name: "a" });
    expect(response.status).toBe(400);
    expect(supervisor.status().operations).toEqual([]);
  });

  it("serves dashboard HTML and compiled assets while returning 404 for unknown paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dashboard-ui-"));
    try {
      await mkdir(join(directory, "assets"));
      await writeFile(
        join(directory, "index.html"),
        '<html><script src="/__local-dashboard/assets/app.js"></script></html>'
      );
      await writeFile(
        join(directory, "assets/app.js"),
        'console.log("dashboard");'
      );
      const { supervisor } = setup();
      const app = createApp(
        supervisor,
        {
          identities: async () => ({ ready: false, tenants: [] }),
          identity: async () => ({ sessionToken: "token" }),
        },
        directory
      );
      for (const path of ["/", "/__local-dashboard/"]) {
        const response = await request(app).get(path);
        expect(response.status).toBe(200);
        expect(response.text).toContain("<html>");
      }
      const asset = await request(app).get("/__local-dashboard/assets/app.js");
      expect(asset.status).toBe(200);
      expect(asset.headers["content-type"]).toMatch(/javascript/);
      expect(asset.text).toBe('console.log("dashboard");');
      for (const path of [
        "/not-a-route",
        "/assets/missing.js",
        "/__local-dashboard/assets/missing.js",
      ]) {
        expect((await request(app).get(path)).status).toBe(404);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("rejects arbitrary commands, reset without confirmation, and invalid log cursors", async () => {
    const { app } = setup();
    expect(
      (
        await request(app)
          .post("/__local-dashboard/api/actions")
          .send({ type: "exec", command: "bash" })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/__local-dashboard/api/actions")
          .send({ type: "infra.reset", confirm: false })
      ).status
    ).toBe(400);
    expect(
      (await request(app).get("/__local-dashboard/api/logs?cursors=not-json"))
        .status
    ).toBe(400);
    expect(
      (await request(app).get("/__local-dashboard/api/logs?limit=99999")).status
    ).toBe(400);
  });
  it("returns 202 with a pollable operation and validates the actual status contract", async () => {
    const { app, supervisor } = setup();
    const response = await request(app)
      .post("/__local-dashboard/api/actions")
      .send({ type: "package.start", name: "a" });
    expect(response.status).toBe(202);
    const accepted = schemas.OperationAccepted.parse(response.body);
    await supervisor.idle();
    const state = schemas.DashboardStatus.parse(
      (await request(app).get("/__local-dashboard/api/status")).body
    );
    expect(
      state.operations.find((op) => op.id === accepted.operationId)?.state
    ).toBe("passed");
  });
  it("preserves the identity/session shape and denies cross-origin mutations", async () => {
    const { app } = setup();
    expect(
      schemas.IdentitiesResponse.parse(
        (await request(app).get("/__local-dashboard/api/identities")).body
      ).ready
    ).toBe(false);
    const response = await request(app)
      .post("/__local-dashboard/api/identity")
      .send({ tenantKey: "comune", userId: "admin" });
    expect(response.body).toEqual({ sessionToken: "token" });
    expect(
      (
        await request(app)
          .post("/__local-dashboard/api/identity")
          .set("Host", "localhost:3000")
          .set("Origin", "http://localhost:3000")
          .send({ tenantKey: "comune", userId: "admin" })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/__local-dashboard/api/actions")
          .set("Origin", "https://attacker.test")
          .send({ type: "seed" })
      ).status
    ).toBe(403);
  });
});
