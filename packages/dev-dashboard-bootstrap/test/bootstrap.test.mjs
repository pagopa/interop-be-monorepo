import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { test } from "node:test";

import {
  discoverRunnablePackages,
  readPackageEnvironment,
} from "../src/index.mjs";

const fixture = async (context) => {
  const root = await mkdtemp(join(tmpdir(), "dashboard-bootstrap-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
};

const createPackage = async (
  root,
  directory,
  {
    name = `pagopa-interop-${directory}`,
    start = "tsx src/index.ts",
    source = "startServer();\n",
    env = "PORT=3500\n",
  } = {}
) => {
  const path = join(root, "packages", directory);
  await mkdir(join(path, "src"), { recursive: true });
  await writeFile(
    join(path, "package.json"),
    JSON.stringify({ name, scripts: { start } })
  );
  if (source !== null) await writeFile(join(path, "src/index.ts"), source);
  if (env !== null) await writeFile(join(path, ".env"), env);
  return path;
};

test("reads development dotenv precedence, quotes and comments without inherited process values", async (context) => {
  const path = await fixture(context);
  const inheritedPort = process.env.PORT;
  const inheritedNodeEnv = process.env.NODE_ENV;
  process.env.PORT = "9999";
  process.env.NODE_ENV = "production";
  context.after(() => {
    if (inheritedPort === undefined) delete process.env.PORT;
    else process.env.PORT = inheritedPort;
    if (inheritedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = inheritedNodeEnv;
  });
  await writeFile(
    join(path, ".env"),
    "PORT=3100\nBASE=base\nDOUBLE=\"value # retained\"\nSINGLE='single # retained'\nPLAIN=plain # ignored\n"
  );
  await writeFile(join(path, ".env.local"), "PORT=3200\nMIDDLE=local\n");
  await writeFile(
    join(path, ".env.development"),
    'PORT="3300" # ignored\nMIDDLE=development\n'
  );
  await writeFile(join(path, ".env.production"), "PORT=9998\n");

  assert.equal(readPackageEnvironment(path, "service").PORT, "3300");

  await writeFile(
    join(path, ".env.development.local"),
    "PORT='3400' # ignored\n"
  );
  assert.deepEqual(readPackageEnvironment(path, "service"), {
    PORT: "3400",
    BASE: "base",
    DOUBLE: "value # retained",
    SINGLE: "single # retained",
    PLAIN: "plain",
    MIDDLE: "development",
  });
  assert.equal(process.env.PORT, "9999");
  assert.equal(process.env.NODE_ENV, "production");
});

test("accepts a package without dotenv files and shares the authorization-server port override", async (context) => {
  const path = await fixture(context);
  assert.deepEqual(readPackageEnvironment(path, "service"), {});
  await writeFile(
    join(path, ".env.development.local"),
    "PORT=not-a-port\nOTHER=kept\n"
  );
  assert.deepEqual(
    readPackageEnvironment(path, "pagopa-interop-authorization-server"),
    { PORT: "4700", OTHER: "kept" }
  );
});

for (const port of [
  "invalid",
  "3500suffix",
  "0",
  "65536",
  "-1",
  "1.5",
  "Infinity",
  "0x1000",
  "1e3",
]) {
  test(`rejects invalid effective PORT ${port}`, async (context) => {
    const path = await fixture(context);
    await writeFile(join(path, ".env"), `PORT=${port}\n`);
    assert.throws(
      () => readPackageEnvironment(path, "pagopa-interop-service"),
      /pagopa-interop-service.*PORT.*1.*65535/
    );
  });
}

test("discovers new runnable packages in directory order, with optional and boundary ports", async (context) => {
  const root = await fixture(context);
  const path = await createPackage(root, "service", { env: "PORT=3100\n" });
  await writeFile(
    join(path, ".env.development.local"),
    'PORT="4200" # local\n'
  );
  await createPackage(root, "authorization-server", { env: "PORT=4500\n" });
  await createPackage(root, "new-worker", { env: null });
  await createPackage(root, "empty-job", { env: "PORT=\n" });
  await createPackage(root, "low-service", { env: "PORT=1\n" });
  await createPackage(root, "high-service", { env: "PORT=65535\n" });

  assert.deepEqual(await discoverRunnablePackages(root), [
    {
      name: "pagopa-interop-authorization-server",
      directory: "authorization-server",
      port: 4700,
    },
    { name: "pagopa-interop-empty-job", directory: "empty-job" },
    {
      name: "pagopa-interop-high-service",
      directory: "high-service",
      port: 65535,
    },
    { name: "pagopa-interop-low-service", directory: "low-service", port: 1 },
    { name: "pagopa-interop-new-worker", directory: "new-worker" },
    { name: "pagopa-interop-service", directory: "service", port: 4200 },
  ]);
});

test("skips dashboard packages, invalid manifests, missing entries and comment or reexport-only entries", async (context) => {
  const root = await fixture(context);
  await createPackage(root, "dev-dashboard-api");
  await createPackage(root, "missing-entry", { source: null });
  const missingStart = await createPackage(root, "missing-start");
  await writeFile(
    join(missingStart, "package.json"),
    JSON.stringify({ name: "pagopa-interop-missing-start" })
  );
  await createPackage(root, "empty-start", { start: "" });
  await createPackage(root, "invalid-start", { start: 123 });
  await createPackage(root, "invalid-name", { name: 123 });
  const invalidJson = await createPackage(root, "invalid-json");
  await writeFile(join(invalidJson, "package.json"), "invalid json");
  const unreadableEntry = await createPackage(root, "unreadable-entry", {
    source: null,
  });
  await mkdir(join(unreadableEntry, "src/index.ts"));
  await createPackage(root, "comments", {
    source: "/* docs */\n  // comment\n",
  });
  await createPackage(root, "star-barrel", {
    source: 'export * from "./library.js";\n',
  });
  await createPackage(root, "namespace-barrel", {
    source: 'export * as $clients from "./library.js";\n',
  });
  await createPackage(root, "named-barrel", {
    source: 'export {\n client,\n other as renamed\n} from "./library.js";\n',
  });
  await createPackage(root, "executable-barrel", {
    source: 'export * from "./library.js";\nstartServer();\n',
  });
  await writeFile(join(root, "packages/not-a-directory"), "ignored");

  assert.deepEqual(await discoverRunnablePackages(root), [
    {
      name: "pagopa-interop-executable-barrel",
      directory: "executable-barrel",
      port: 3500,
    },
  ]);
});

test("fails discovery with the package name when a runnable package has an invalid port", async (context) => {
  const root = await fixture(context);
  await createPackage(root, "invalid-service", { env: "PORT=70000\n" });
  await assert.rejects(
    discoverRunnablePackages(root),
    /pagopa-interop-invalid-service.*PORT/
  );
});
