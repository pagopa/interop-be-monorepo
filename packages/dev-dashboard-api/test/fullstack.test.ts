import { createServer, type Server } from "node:http";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { SEED_PACKAGES } from "../src/config/constants.js";
import { frontendServiceBuilder } from "../src/services/frontendService.js";
import { supervisorServiceBuilder } from "../src/services/supervisorService.js";

const servers: Server[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
      )
  );
});

async function setup(
  failCommand?: string,
  beforeCommand?: (type: string) => Promise<void>
) {
  const commands: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  let available = true;
  let running = false;
  let mode = "local";
  const respond = async (url: string, body: string): Promise<Response> => {
    if (url.endsWith("/status"))
      return Response.json({
        available,
        running,
        mode,
        state: running ? "passed" : "pending",
        phases: [],
        identity: { tenantKey: "comune", userKey: "admin" },
      });
    if (url.endsWith("/commands")) {
      const command = JSON.parse(body);
      commands.push(command);
      events.push(`frontend:${command.type}`);
      await beforeCommand?.(command.type);
      if (command.type === failCommand)
        return Response.json({ error: "Check failed" }, { status: 409 });
      if (command.type === "start") {
        running = true;
        mode = command.mode;
      }
      if (command.type === "stop") running = false;
      return Response.json({});
    }
    throw new Error(`Unexpected agent request ${url}`);
  };
  const agent = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      void respond(request.url ?? "", body).then(async (result) => {
        response.writeHead(result.status, {
          "Content-Type": "application/json",
        });
        response.end(await result.text());
      });
    });
  });
  servers.push(agent);
  await new Promise<void>((resolve) => {
    agent.listen(0, "127.0.0.1", resolve);
  });
  const address = agent.address();
  if (!address || typeof address === "string")
    throw new Error("Missing agent test port");
  const supervisor = supervisorServiceBuilder({
    beRoot: "/be",
    packages: SEED_PACKAGES.map((name) => ({
      name,
      label: name,
      kind: "worker",
      state: "stopped",
      watch: true,
    })),
    presets: [
      {
        id: "frontend-full",
        name: "Frontend",
        source: "shared",
        packages: SEED_PACKAGES.map((name) => ({ name })),
      },
    ],
    driver: {
      run: async (command) => {
        events.push(`backend:${command.args.at(-1)}`);
        return "";
      },
      start: async () => ({ pid: 1, stop: async () => undefined }),
    },
  });
  const identities = {
    identities: vi.fn(async () => ({
      ready: true,
      tenants: [
        {
          key: "comune",
          id: "tenant-id",
          name: "Comune",
          selfcareId: "selfcare",
          users: [
            {
              key: "admin",
              id: "user-id",
              name: "Admin",
              surname: "User",
              email: "admin@example.test",
              roles: ["admin"],
            },
          ],
        },
      ],
    })),
    identity: vi.fn(async () => ({ sessionToken: "private.session.token" })),
  };
  const frontend = frontendServiceBuilder(
    `http://127.0.0.1:${address.port}`,
    supervisor,
    identities
  );
  const app = createApp(supervisor, identities, undefined, frontend);
  return {
    app,
    frontend,
    supervisor,
    commands,
    identities,
    events,
    disconnect: () => {
      available = false;
    },
  };
}

describe("backend-owned fullstack lifecycle", () => {
  it("starts dependencies, backend and identity before Vite and checks, exposing pollable progress", async () => {
    const { app, frontend, commands, identities, events } = await setup();
    const accepted = await request(app)
      .post("/__local-dashboard/api/frontend/actions")
      .send({ type: "start" });
    expect(accepted.status).toBe(202);
    await frontend.idle();
    const status = (await request(app).get("/__local-dashboard/api/status"))
      .body;
    expect(status.frontend).toMatchObject({
      operationId: accepted.body.operationId,
      state: "passed",
      running: true,
    });
    expect(
      status.frontend.phases.map((phase: { state: string }) => phase.state)
    ).toEqual(Array(9).fill("passed"));
    expect(
      status.frontend.phases.find(
        (phase: { id: string }) => phase.id === "backend"
      ).operationId
    ).toEqual(expect.any(String));
    expect(commands.map((command) => command.type)).toEqual([
      "install",
      "start",
      "smoke",
      "browser",
    ]);
    expect(commands[1]).toMatchObject({
      mode: "local",
      sessionToken: "private.session.token",
      identity: { tenantKey: "comune", userKey: "admin" },
    });
    expect(identities.identity).toHaveBeenCalledWith({
      tenantKey: "comune",
      userId: "user-id",
    });
    expect(events.indexOf("frontend:install")).toBeLessThan(
      events.indexOf("backend:recover")
    );
    expect(events.indexOf("backend:seed")).toBeLessThan(
      events.indexOf("frontend:start")
    );
    expect(JSON.stringify(status)).not.toContain("private.session.token");
    expect(status.frontend).not.toHaveProperty("identity");
  });

  it("skips remaining phases on failure, stops Vite and supports retry without reinstalling an active frontend", async () => {
    const { frontend, commands } = await setup("smoke");
    frontend.action({ type: "start" });
    await frontend.idle();
    expect(await frontend.status()).toMatchObject({
      state: "failed",
      error: "Check failed",
      phases: expect.arrayContaining([
        expect.objectContaining({ id: "smoke", state: "failed" }),
        expect.objectContaining({ id: "browser", state: "skipped" }),
      ]),
    });
    expect(commands.map((command) => command.type)).toEqual([
      "install",
      "start",
      "smoke",
      "stop",
    ]);
    frontend.action({ type: "use-dev" });
    await frontend.idle();
    expect(await frontend.status()).toMatchObject({
      state: "passed",
      mode: "dev",
      running: true,
    });
    frontend.action({ type: "start" });
    await frontend.idle();
    expect(
      commands.filter((command) => command.type === "install")
    ).toHaveLength(1);
  });

  it("keeps frontend controls optional and rejects invalid and overlapping actions", async () => {
    const { app, frontend } = await setup();
    expect(
      (
        await request(app)
          .post("/__local-dashboard/api/frontend/actions")
          .send({ type: "shell", command: "anything" })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/__local-dashboard/api/frontend/actions")
          .set("Sec-Fetch-Site", "cross-site")
          .send({ type: "start" })
      ).status
    ).toBe(403);
    frontend.action({ type: "start" });
    expect(() => frontend.action({ type: "stop" })).toThrow(/already running/);
    await frontend.idle();
    frontend.action({ type: "stop" });
    await frontend.idle();
    expect(await frontend.status()).toMatchObject({
      state: "stopped",
      running: false,
    });
  });

  it("does not proceed to seed or Vite after a backend failure", async () => {
    const { frontend, supervisor, commands } = await setup();
    vi.spyOn(supervisor, "action").mockImplementation(() => {
      throw new Error("Infrastructure failed");
    });
    frontend.action({ type: "start" });
    await frontend.idle();
    expect(await frontend.status()).toMatchObject({
      state: "failed",
      error: "Infrastructure failed",
      phases: expect.arrayContaining([
        expect.objectContaining({ id: "infra", state: "failed" }),
        expect.objectContaining({ id: "seed", state: "skipped" }),
      ]),
    });
    expect(commands.map((command) => command.type)).toEqual([
      "install",
      "stop",
    ]);
  });

  it("stops scheduling work when the frontend disappears or the dashboard shuts down", async () => {
    const { frontend, supervisor, disconnect, commands } = await setup();
    const idle = supervisor.idle;
    vi.spyOn(supervisor, "idle").mockImplementation(async () => {
      await idle();
      disconnect();
    });
    frontend.action({ type: "start" });
    await frontend.idle();
    expect(await frontend.status()).toMatchObject({
      available: false,
      state: "failed",
      error: "Cannot reach the frontend runtime",
    });
    expect(commands.some((command) => command.type === "start")).toBe(false);
    await frontend.shutdown();
    expect(() => frontend.action({ type: "start" })).toThrow(/shutting down/);
  });

  it("resolves identity and local mode on the backend and resets after stopping Vite", async () => {
    const { frontend, identities, commands, events } = await setup();
    frontend.action({
      type: "identity",
      tenantKey: "comune",
      userKey: "admin",
    });
    await frontend.idle();
    expect(await frontend.status()).toMatchObject({
      state: "passed",
      mode: "local",
    });
    frontend.action({ type: "use-dev" });
    await frontend.idle();
    frontend.action({ type: "use-local" });
    await frontend.idle();
    expect(identities.identity).toHaveBeenCalledTimes(2);
    expect(commands.map((command) => command.type)).toEqual([
      "start",
      "start",
      "start",
    ]);
    frontend.action({ type: "reset" });
    await frontend.idle();
    expect(await frontend.status()).toMatchObject({
      state: "stopped",
      running: false,
    });
    expect(events.indexOf("frontend:stop")).toBeLessThan(
      events.indexOf("backend:reset")
    );
    expect(events).not.toContain("backend:seed");
  });

  it("serves progress during a pending frontend command and cancels the command on dashboard shutdown", async () => {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { app, frontend, supervisor, commands } = await setup(
      undefined,
      () => held
    );
    try {
      const accepted = frontend.action({ type: "start" });
      await vi.waitFor(() => expect(commands).toHaveLength(1));
      const status = (await request(app).get("/__local-dashboard/api/status"))
        .body;
      expect(status.frontend).toMatchObject({
        state: "running",
        operationId: accepted.operationId,
        phases: expect.arrayContaining([
          expect.objectContaining({ id: "install", state: "running" }),
        ]),
      });
      await frontend.shutdown();
      expect(supervisor.status().operations).toEqual([]);
      expect(commands.map((command) => command.type)).toEqual(["install"]);
      expect(() => frontend.action({ type: "start" })).toThrow(/shutting down/);
    } finally {
      release();
    }
  });
});
