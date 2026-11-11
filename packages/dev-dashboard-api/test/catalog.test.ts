import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  discoverPackages,
  readPresets,
} from "../src/services/catalogService.js";
import { localEnvironment } from "../src/services/environmentService.js";
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))
  );
});
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "dashboard-catalog-"));
  dirs.push(root);
  for (const [name, entry] of [
    ["tenant-process", true],
    ["remote-job", true],
    ["local-job", true],
    ["authorization-server", true],
    ["unreviewed-aws-job", true],
    ["library", false],
    ["barrel-library", true],
  ] satisfies Array<[string, boolean]>) {
    const path = join(root, "packages", name);
    await mkdir(join(path, "src"), { recursive: true });
    await writeFile(
      join(path, "package.json"),
      JSON.stringify({
        name: `pagopa-interop-${name}`,
        scripts: { start: "tsx src/index.ts" },
      })
    );
    if (entry)
      await writeFile(
        join(path, "src/index.ts"),
        name === "barrel-library"
          ? '// Re-export only\nexport * as clients from "./clients.js";\n'
          : name === "unreviewed-aws-job"
            ? 'import { STSClient } from "@aws-sdk/client-sts";\nnew STSClient();'
            : "console.log('entry');"
      );
    await writeFile(
      join(path, ".env"),
      `PORT=3500\nEVENTSTORE_DB_HOST=localhost\nKAFKA_BROKERS=localhost:9092\n${name === "remote-job" ? "SOURCE_URL=https://external.example.com/data\n" : ""}`
    );
  }
  return root;
};
describe("runnable package catalogue and local boundary", () => {
  it("disables watch by default for jobs while services keep watch enabled", async () => {
    const root = await fixture();
    await writeFile(join(root, "packages/local-job/.env"), "LOG_LEVEL=info\n");

    const packages = await discoverPackages(root);

    expect(
      packages.find((item) => item.name === "pagopa-interop-local-job")
    ).toMatchObject({ kind: "job", state: "stopped", watch: false });
    expect(
      packages.find((item) => item.name === "pagopa-interop-tenant-process")
    ).toMatchObject({ kind: "service", watch: true });
  });

  it("loads legacy disk presets as package groups without obsolete orchestration flags", async () => {
    const root = await fixture();
    await mkdir(join(root, "docker/local-development"), { recursive: true });
    const shared = {
      id: "frontend-full",
      name: "Frontend backend",
      source: "shared",
      packages: [{ name: "backend", watch: false }],
      seed: true,
      fullstack: true,
    };
    const personal = {
      ...shared,
      id: "mine",
      source: "personal",
      fullstack: false,
    };
    await writeFile(
      join(root, "docker/local-development/presets.json"),
      JSON.stringify([shared])
    );
    const personalPath = join(root, "presets.json");
    await writeFile(personalPath, JSON.stringify([personal]));
    const presets = await readPresets(root, personalPath);
    expect(presets).toHaveLength(2);
    presets.forEach((preset) => {
      expect(preset).not.toHaveProperty("seed");
      expect(preset).not.toHaveProperty("fullstack");
      expect(preset.packages).toEqual(shared.packages);
    });
    await writeFile(
      personalPath,
      JSON.stringify([{ ...personal, command: "bash" }])
    );
    await expect(readPresets(root, personalPath)).rejects.toThrow();
  });
  it.each([
    ["/* documentation */\n   // comment\n", false],
    ['export * from "./clients.js";\n', false],
    ['export * as $clients from "./clients.js";\n', false],
    ['export {\n client,\n other as renamed\n} from "./clients.js";\n', false],
    ['export * from "./clients.js";\nstartServer();\n', true],
  ])(
    "distinguishes executable source from a barrel: %s",
    async (source, executable) => {
      const root = await fixture();
      await writeFile(
        join(root, "packages/barrel-library/src/index.ts"),
        source
      );
      const packages = await discoverPackages(root);
      expect(
        packages.some((item) => item.name === "pagopa-interop-barrel-library")
      ).toBe(executable);
    }
  );

  it.each([
    ["DATABASE_HOST=remote.example.com", false],
    ["KAFKA_BROKERS=localhost:9092,remote.example.com:9092", false],
    ["SERVICE_URL=http://localhost:3000,http://remote.example.com", false],
    ["SERVICE_ENDPOINT=not-a-url", false],
    ["SERVICE_URL=http://user:password@localhost:3000", false],
    ["SERVICE_URL=https://localhost:3000", false],
    ["LOGIN_CALLBACK_URL=https://external.example.com/callback", true],
    ["SERVICE_URL=http://localhost:3000,http://127.0.0.1:3001", true],
    ["OPTIONAL_URL=", true],
  ])("validates environment setting %s", async (setting, accepted) => {
    const root = await fixture();
    await writeFile(
      join(root, "packages/tenant-process/.env.local"),
      `${setting}\n`
    );
    const result = localEnvironment(root, "pagopa-interop-tenant-process");
    if (accepted) {
      await expect(result).resolves.toBeDefined();
    } else {
      await expect(result).rejects.toThrow(/local|loopback/i);
    }
  });

  it("loads the shared frontend backend workload with runnable packages and watch disabled", async () => {
    const root = fileURLToPath(new URL("../../..", import.meta.url));
    const personalRoot = await mkdtemp(join(tmpdir(), "dashboard-presets-"));
    dirs.push(personalRoot);
    const presets = await readPresets(root, join(personalRoot, "presets.json"));
    const frontendBackend = presets.find(
      (preset) => preset.id === "frontend-full"
    );
    if (!frontendBackend) throw new Error("Frontend backend preset is missing");
    expect(frontendBackend).toMatchObject({
      source: "shared",
      name: "Frontend backend",
    });
    expect(frontendBackend).not.toHaveProperty("seed");
    expect(frontendBackend).not.toHaveProperty("fullstack");
    const names = frontendBackend.packages.map((member) => member.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "pagopa-interop-backend-for-frontend",
        "pagopa-interop-tenant-process",
        "pagopa-interop-tenant-readmodel-writer-sql",
        "pagopa-interop-attribute-registry-process",
        "pagopa-interop-attribute-registry-readmodel-writer-sql",
        "pagopa-interop-in-app-notification-manager",
      ])
    );
    expect(new Set(names).size).toBe(names.length);
    const catalogue = await discoverPackages(root);
    const runnable = new Set(catalogue.map((item) => item.name));
    expect(names.every((name) => runnable.has(name))).toBe(true);
    expect(
      frontendBackend.packages.every((member) => member.watch === false)
    ).toBe(true);
  });
  it("lists executable packages without a manually reviewed support profile", async () => {
    const root = await fixture();
    const packages = await discoverPackages(root);
    const item = packages.find(
      (entry) => entry.name === "pagopa-interop-unreviewed-aws-job"
    );
    expect(item).toMatchObject({ state: "stopped", watch: true });
    expect(item).not.toHaveProperty("localSupported");
    expect(item).not.toHaveProperty("prerequisites");
    await expect(
      localEnvironment(root, "pagopa-interop-unreviewed-aws-job")
    ).resolves.toMatchObject({
      AWS_ACCESS_KEY_ID: "testawskey",
      AWS_ENDPOINT_URL: "http://localhost:4566",
    });
  });
  it("supplies the local topics required by the M2M dispatcher and notifier configuration parsers", async () => {
    const root = fileURLToPath(new URL("../../..", import.meta.url));
    expect(
      await localEnvironment(root, "pagopa-interop-m2m-event-dispatcher")
    ).toMatchObject({
      PURPOSE_TEMPLATE_TOPIC: "event-store.purpose_template.events",
    });
    expect(
      await localEnvironment(root, "pagopa-interop-notifier-seeder")
    ).toMatchObject({
      AGREEMENT_TOPIC: "event-store.agreement.events",
      AUTHORIZATION_TOPIC: "event-store.authorization.events",
    });
  });
  it("finds real start entrypoints independently of integration configuration", async () => {
    const root = await fixture();
    const packages = await discoverPackages(root);
    expect(packages.map((p) => p.name)).toEqual([
      "pagopa-interop-authorization-server",
      "pagopa-interop-local-job",
      "pagopa-interop-remote-job",
      "pagopa-interop-tenant-process",
      "pagopa-interop-unreviewed-aws-job",
    ]);
  });
  it("skips an unreadable package entrypoint without interrupting discovery", async () => {
    const root = await fixture();
    const entrypoint = join(root, "packages/tenant-process/src/index.ts");
    await rm(entrypoint);
    await mkdir(entrypoint);

    const packages = await discoverPackages(root);

    expect(packages.map((item) => item.name)).toEqual([
      "pagopa-interop-authorization-server",
      "pagopa-interop-local-job",
      "pagopa-interop-remote-job",
      "pagopa-interop-unreviewed-aws-job",
    ]);
  });
  it.each(["invalid", "0", "65536", "-1", "1.5"])(
    "rejects invalid effective PORT %s instead of exposing it in the catalogue",
    async (port) => {
      const root = await fixture();
      await writeFile(
        join(root, "packages/tenant-process/.env.development.local"),
        `PORT=${port}\n`
      );

      await expect(discoverPackages(root)).rejects.toThrow(
        /pagopa-interop-tenant-process.*PORT/
      );
      await expect(
        localEnvironment(root, "pagopa-interop-tenant-process")
      ).rejects.toThrow(/pagopa-interop-tenant-process.*PORT/);
    }
  );
  it("maps shared dotenv ports and portless packages to catalogue metadata", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "packages/tenant-process/.env.development.local"),
      'PORT="4567" # local override\n'
    );
    await writeFile(join(root, "packages/local-job/.env"), "PORT=\n");

    const packages = await discoverPackages(root);

    expect(
      packages.find((item) => item.name === "pagopa-interop-tenant-process")
    ).toEqual({
      name: "pagopa-interop-tenant-process",
      label: "tenant-process",
      kind: "service",
      port: 4567,
      state: "stopped",
      watch: true,
    });
    expect(
      packages.find((item) => item.name === "pagopa-interop-local-job")
    ).toEqual({
      name: "pagopa-interop-local-job",
      label: "local-job",
      kind: "job",
      state: "stopped",
      watch: false,
    });
    await expect(
      localEnvironment(root, "pagopa-interop-authorization-server")
    ).resolves.toMatchObject({
      PORT: "4700",
      GENERATED_INTEROP_TOKEN_M2M_AUDIENCE: "dev.interop.pagopa.it/m2m",
      AWS_ACCESS_KEY_ID: "testawskey",
    });
  });
  it("forces local Selfcare/DynamoDB/AWS endpoint defaults and refuses remote overrides", async () => {
    const root = await fixture();
    const name = "pagopa-interop-tenant-process";
    const env = await localEnvironment(root, name);
    expect(env).toMatchObject({
      SELFCARE_V2_URL: "http://localhost:8006",
      DYNAMO_DB_ENDPOINT: "http://localhost:8085",
      AWS_ACCESS_KEY_ID: "testawskey",
      AWS_EC2_METADATA_DISABLED: "true",
    });
    await writeFile(
      join(root, "packages/tenant-process/.env.local"),
      "TENANT_PROCESS_URL=https://dev.example.com\n"
    );
    await expect(localEnvironment(root, name)).rejects.toThrow(
      /loopback|local/i
    );
  });
  it("reads the full package names and effective ports from the checkout", async () => {
    const root = fileURLToPath(new URL("../../..", import.meta.url));
    const packages = await discoverPackages(root);
    expect(packages).toHaveLength(91);
    expect(
      packages.find(
        (item) => item.name === "pagopa-interop-backend-for-frontend"
      )
    ).toMatchObject({ port: 3600, state: "stopped", watch: true });
    expect(
      packages.find(
        (item) => item.name === "pagopa-interop-authorization-server"
      )
    ).toMatchObject({ port: 4700, state: "stopped" });
    expect(
      packages.some((item) => item.name === "pagopa-interop-one-trust-notices")
    ).toBe(true);
  });
  it("aligns locally issued M2M tokens with both gateway audiences", async () => {
    const root = fileURLToPath(new URL("../../..", import.meta.url));
    const auth = await localEnvironment(
      root,
      "pagopa-interop-authorization-server"
    );
    for (const name of [
      "pagopa-interop-m2m-gateway",
      "pagopa-interop-m2m-gateway-v3",
    ]) {
      const gateway = await localEnvironment(root, name);
      expect(gateway.ACCEPTED_AUDIENCES?.split(",")).toContain(
        auth.GENERATED_INTEROP_TOKEN_M2M_AUDIENCE
      );
    }
  });
});
