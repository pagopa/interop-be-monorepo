import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const [source, destination] = process.argv.slice(2);
await mkdir(destination, { recursive: true });
for (const file of [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".npmrc",
]) {
  await cp(join(source, file), join(destination, file));
}
// Keep all importers for frozen-lockfile validation without installing/building them.
for (const entry of await readdir(join(source, "packages"), {
  withFileTypes: true,
})) {
  if (!entry.isDirectory()) continue;
  const target = join(destination, "packages", entry.name);
  await mkdir(target, { recursive: true });
  try {
    await cp(
      join(source, "packages", entry.name, "package.json"),
      join(target, "package.json"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await cp(
  join(source, "packages/dev-dashboard-bootstrap"),
  join(destination, "packages/dev-dashboard-bootstrap"),
  { recursive: true },
);
await mkdir(join(destination, "docker/dev-dashboard"), { recursive: true });
await cp(
  join(source, "docker/dev-dashboard/generate-compose.mjs"),
  join(destination, "docker/dev-dashboard/generate-compose.mjs"),
);
