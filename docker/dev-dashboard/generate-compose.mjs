import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { discoverRunnablePackages } from "../../packages/dev-dashboard-bootstrap/src/index.mjs";

const { values } = parseArgs({
  options: {
    checkout: { type: "string" },
    source: { type: "string" },
    uid: { type: "string" },
    gid: { type: "string" },
    autostart: { type: "string", default: "true" },
    preset: { type: "string", default: "" },
  },
});

try {
  const { checkout, source, uid, gid, autostart, preset } = values;
  if (!checkout || !source || !uid || !gid)
    throw new Error("Checkout, source, UID and GID are required");
  if (/[\x00-\x1f]/.test(source))
    throw new Error("Workspace paths cannot contain control characters");
  const base = JSON.parse(readFileSync(0, "utf8"));
  const reserved = new Map([[3000, "frontend public origin"]]);
  for (const [name, service] of Object.entries(base.services)) {
    for (const port of service.ports ?? []) {
      if (port.published) reserved.set(Number(port.published), name);
    }
  }
  const targets = new Map();
  const publishedPorts = new Map(reserved);
  const ports = [];
  for (const { name, port } of await discoverRunnablePackages(checkout)) {
    if (port === undefined) continue;
    // The frontend public origin occupies 3000 in a separate container.
    const published = port === 3000 ? 13000 : port;
    const targetOwner =
      targets.get(port) ?? (port !== 3000 ? reserved.get(port) : undefined);
    if (targetOwner)
      throw new Error(`PORT ${port} for ${name} conflicts with ${targetOwner}`);
    const publishedOwner = publishedPorts.get(published);
    if (publishedOwner)
      throw new Error(
        `Published port ${published} for ${name} conflicts with ${publishedOwner}`,
      );
    targets.set(port, name);
    publishedPorts.set(published, name);
    ports.push({
      target: port,
      published: String(published),
      host_ip: "127.0.0.1",
    });
  }

  const volumes = { "dashboard-be-modules": {}, "dashboard-pnpm-store": {} };
  const dependency = (name, target) => ({
    type: "volume",
    source: name,
    target,
    volume: { nocopy: true },
  });
  const mounts = [
    { type: "bind", source, target: source },
    dependency("dashboard-be-modules", join(source, "node_modules")),
    dependency("dashboard-pnpm-store", "/home/node/.local/share/pnpm"),
  ];
  const directories = await readdir(join(checkout, "packages"), {
    withFileTypes: true,
  });
  for (const directory of directories
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    try {
      await readFile(
        join(checkout, "packages", directory.name, "package.json"),
      );
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const name = `dashboard-be-${directory.name}-modules`;
    volumes[name] = {};
    mounts.push(
      dependency(
        name,
        join(source, "packages", directory.name, "node_modules"),
      ),
    );
  }
  const override = {
    services: {
      dashboard: {
        working_dir: source,
        environment: {
          INTEROP_BE_ROOT: source,
          INTEROP_DASHBOARD_RUNTIME: "true",
          LOCAL_UID: uid,
          LOCAL_GID: gid,
          DASHBOARD_AUTOSTART: autostart,
          ...(preset ? { DASHBOARD_AUTOSTART_PRESET: preset } : {}),
        },
        volumes: mounts,
        ports,
      },
    },
    volumes,
  };
  // Values are literal checkout paths/settings, never Compose substitutions.
  process.stdout.write(
    `${JSON.stringify(override).replaceAll("$", () => "$$")}\n`,
  );
} catch (error) {
  console.error(`Cannot prepare dashboard runtime: ${error.message}`);
  process.exitCode = 1;
}
