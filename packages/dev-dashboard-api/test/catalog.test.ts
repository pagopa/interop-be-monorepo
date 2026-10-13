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

  it("loads the shared fullstack workload with runnable packages and watch disabled", async () => {
    const root = fileURLToPath(new URL("../../..", import.meta.url));
    const personalRoot = await mkdtemp(join(tmpdir(), "dashboard-presets-"));
    dirs.push(personalRoot);
    const presets = await readPresets(root, join(personalRoot, "presets.json"));
    const fullstack = presets.find((preset) => preset.fullstack);
    if (!fullstack) throw new Error("Fullstack preset is missing");
    expect(fullstack).toMatchObject({ source: "shared", seed: true });
    const names = fullstack.packages.map((member) => member.name);
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
    expect(fullstack.packages.every((member) => member.watch === false)).toBe(
      true
    );
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
