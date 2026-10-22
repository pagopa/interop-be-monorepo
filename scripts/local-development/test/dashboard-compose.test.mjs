import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const script = path.join(repository, "scripts/local-development/dashboard.sh");
const generator = path.join(
  repository,
  "docker/dev-dashboard/generate-compose.mjs",
);

async function fixture() {
  const root = await mkdtemp(
    path.join(tmpdir(), "interop compose $ with, spaces "),
  );
  const bin = path.join(root, "bin");
  const calls = path.join(root, "docker-calls.jsonl");
  const output = path.join(root, ".local-development/dashboard/compose.yml");
  await mkdir(bin);
  await mkdir(path.join(root, "packages"));
  const base = {
    services: {
      dashboard: { ports: [{ target: 8076, published: "8076" }] },
      postgres: { ports: [{ target: 5432, published: "6001" }] },
    },
  };
  const config = path.join(root, "base.json");
  await writeFile(config, JSON.stringify(base));
  await writeFile(
    path.join(bin, "docker"),
    `#!${process.execPath}
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALLS, JSON.stringify(args)+'\\n');
if (args[0] === 'compose' && args.includes('config')) {
  if (args.includes('--images')) console.log(process.env.TEST_IMAGE || 'pagopa-interop-dashboard:local');
  else process.stdout.write(fs.readFileSync(process.env.TEST_BASE));
} else if (args[0] === 'run') {
  const index = args.indexOf('--checkout');
  const options = args.slice(index);
  options[1] = process.env.INTEROP_BE_ROOT;
  const result = spawnSync(process.execPath, [process.env.TEST_GENERATOR, ...options], { input: fs.readFileSync(0), encoding: 'utf8' });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  process.exit(result.status ?? 1);
}
`,
    { mode: 0o755 },
  );
  for (const command of ["node", "pnpm"]) {
    await writeFile(
      path.join(bin, command),
      '#!/bin/sh\necho "Host JavaScript tools must not be used" >&2\nexit 99\n',
      { mode: 0o755 },
    );
  }
  const run = (command = "prepare", args = [], env = {}) =>
    spawnSync("bash", [script, command, ...args], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        INTEROP_BE_ROOT: root,
        DASHBOARD_AUTOSTART_PRESET: "",
        TEST_CALLS: calls,
        TEST_BASE: config,
        TEST_GENERATOR: generator,
        ...env,
      },
      encoding: "utf8",
    });
  const addPackage = async (
    directory,
    port,
    source = 'console.log("start");',
  ) => {
    const packageRoot = path.join(root, "packages", directory);
    await mkdir(path.join(packageRoot, "src"), { recursive: true });
    await writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: `pagopa-interop-${directory}`,
        scripts: { start: "tsx src/index.ts" },
      }),
    );
    await writeFile(path.join(packageRoot, "src/index.ts"), source);
    if (port !== undefined)
      await writeFile(path.join(packageRoot, ".env"), `PORT=${port}\n`);
    return packageRoot;
  };
  return {
    root,
    bin,
    calls,
    output,
    run,
    addPackage,
    read: async () => JSON.parse(await readFile(output, "utf8")),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

test("one start builds the helper and derives mounts and effective ports without host Node or pnpm", async () => {
  const f = await fixture();
  try {
    await f.addPackage("catalog-process", 3000);
    await f.addPackage("authorization-server", 8080);
    const api = await f.addPackage("new-api", 5400);
    await writeFile(
      path.join(api, ".env.development.local"),
      'PORT="5500" # local port\n',
    );
    await f.addPackage("library", 5700, 'export * from "./types.js";');
    await f.addPackage("a-worker");
    const result = f.run("start", ["--preset", "frontend-full"]);
    assert.equal(result.status, 0, result.stderr);
    const override = await f.read();
    const service = override.services.dashboard;
    assert.deepEqual(service.ports, [
      { target: 4700, published: "4700", host_ip: "127.0.0.1" },
      { target: 3000, published: "13000", host_ip: "127.0.0.1" },
      { target: 5500, published: "5500", host_ip: "127.0.0.1" },
    ]);
    assert.equal(
      service.environment.DASHBOARD_AUTOSTART_PRESET,
      "frontend-full",
    );
    assert.equal(
      service.volumes[0].source,
      f.root.replaceAll("$", () => "$$"),
    );
    for (const directory of [
      "node_modules",
      "packages/new-api/node_modules",
      "packages/library/node_modules",
      "packages/a-worker/node_modules",
    ]) {
      const mount = service.volumes.find(
        (mount) =>
          mount.target ===
          path.join(f.root, directory).replaceAll("$", () => "$$"),
      );
      assert.equal(mount.type, "volume");
      assert.equal(mount.volume.nocopy, true);
      assert.ok(mount.source in override.volumes);
    }
    const calls = (await readFile(f.calls, "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    const build = calls.findIndex((args) => args.includes("build"));
    const helper = calls.findIndex((args) => args[0] === "run");
    const startup = calls.findIndex((args) => args.includes("up"));
    assert.ok(build >= 0 && build < helper && helper < startup);
    assert.ok(
      calls[helper].includes("--network") && calls[helper].includes("none"),
    );
    assert.ok(calls[helper].includes("--read-only"));
    assert.ok(calls[startup].includes("--no-build"));
    await writeFile(path.join(api, ".env.development.local"), "PORT=5600\n");
    assert.equal(f.run().status, 0);
    assert.ok(
      (await f.read()).services.dashboard.ports.some(
        (port) => port.target === 5600,
      ),
    );
    const added = await f.addPackage("added-api", 5800);
    assert.equal(f.run().status, 0);
    assert.ok(
      (await f.read()).services.dashboard.volumes.some(
        (mount) =>
          mount.target ===
          path.join(added, "node_modules").replaceAll("$", () => "$$"),
      ),
    );
  } finally {
    await f.cleanup();
  }
});

for (const [label, ports, pattern] of [
  [
    "duplicate target",
    [5500, 5500],
    /5500.*(first-api|second-api)|(first-api|second-api).*5500/,
  ],
  ["mapped host collision", [3000, 13000], /13000/],
  ["dashboard port", [8076], /8076/],
  ["infrastructure port", [6001], /6001/],
  ["invalid port", [70000], /PORT/],
]) {
  test(`invalid ${label} preserves the last override and never recreates the runtime`, async () => {
    const f = await fixture();
    try {
      const api = await f.addPackage("first-api", 5400);
      assert.equal(f.run().status, 0);
      const previous = await readFile(f.output, "utf8");
      await writeFile(path.join(api, ".env"), `PORT=${ports[0]}\n`);
      if (ports.length > 1) await f.addPackage("second-api", ports[1]);
      const result = f.run("start");
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, pattern);
      assert.equal(await readFile(f.output, "utf8"), previous);
      const calls = (await readFile(f.calls, "utf8"))
        .trim()
        .split("\n")
        .map(JSON.parse);
      assert.ok(!calls.some((args) => args.includes("up")));
    } finally {
      await f.cleanup();
    }
  });
}

test("prepare uses the image selected by rendered Compose configuration", async () => {
  const f = await fixture();
  try {
    const result = f.run("prepare", [], {
      TEST_IMAGE: "custom-dashboard:local",
    });
    assert.equal(result.status, 0, result.stderr);
    const calls = (await readFile(f.calls, "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.ok(
      calls
        .find((args) => args[0] === "run")
        .includes("custom-dashboard:local"),
    );
  } finally {
    await f.cleanup();
  }
});

for (const [platform, uid, gid, expectedUid, expectedGid] of [
  ["Darwin", "501", "20", "1000", "1000"],
  ["Linux", "1234", "2345", "1234", "2345"],
]) {
  test(`prepare selects the runtime identity for ${platform}`, async () => {
    const f = await fixture();
    try {
      await writeFile(
        path.join(f.bin, "uname"),
        `#!/bin/sh\nprintf '%s\\n' '${platform}'\n`,
        { mode: 0o755 },
      );
      await writeFile(
        path.join(f.bin, "id"),
        `#!/bin/sh\ncase "$1" in -u) echo ${uid};; -g) echo ${gid};; esac\n`,
        { mode: 0o755 },
      );
      const result = f.run();
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        (await f.read()).services.dashboard.environment.LOCAL_UID,
        expectedUid,
      );
      assert.equal(
        (await f.read()).services.dashboard.environment.LOCAL_GID,
        expectedGid,
      );
    } finally {
      await f.cleanup();
    }
  });
}
