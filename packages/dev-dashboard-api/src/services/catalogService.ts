import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Preset, type Package } from "pagopa-interop-dev-dashboard-contracts";
import { z } from "zod";

import { DASHBOARD_PATHS, PACKAGE_LAYOUT } from "../config/constants.js";
import { PackageManifest } from "../model/domain/models.js";
import { isFileNotFoundError } from "../utilities/errorUtils.js";
import { readPackageManifest } from "../utilities/packageUtils.js";
import { effectiveEnvironment } from "./environmentService.js";

// Old disk presets can retain orchestration flags; public inputs stay strict.
const StoredPreset = Preset.extend({
  seed: z.boolean().optional(),
  fullstack: z.boolean().optional(),
}).transform(
  ({ id, name, source, packages }): Preset => ({
    id,
    name,
    source,
    packages,
  })
);

const packageKind = (directory: string, port?: number): Package["kind"] => {
  if (Number.isFinite(port)) return "service";
  return /writer|consumer|dispatcher|updater/.test(directory)
    ? "worker"
    : "job";
};

const hasExecutableSource = (source: string): boolean =>
  Boolean(
    source
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/export\s+\*(?:\s+as\s+[\w$]+)?\s+from\s+["'][^"']+["'];?/g, "")
      .replace(/export\s+\{[^}]*\}\s+from\s+["'][^"']+["'];?/g, "")
      .trim()
  );

const discoverPackage = async (
  root: string,
  directory: string
): Promise<Package | undefined> => {
  const entrypoint = join(
    root,
    PACKAGE_LAYOUT.directory,
    directory,
    PACKAGE_LAYOUT.entrypoint
  );
  let manifest: z.infer<typeof PackageManifest>;
  try {
    manifest = await readPackageManifest(root, directory);
    await access(entrypoint);
  } catch {
    return undefined;
  }
  if (!manifest.scripts?.start) return undefined;
  const source = await readFile(entrypoint, "utf8");
  if (!hasExecutableSource(source)) return undefined;

  const value = effectiveEnvironment(root, directory, manifest.name);
  const port = value.PORT ? Number(value.PORT) : undefined;
  return {
    name: manifest.name,
    label: directory,
    kind: packageKind(directory, port),
    ...(port && Number.isFinite(port) ? { port } : {}),
    state: "stopped",
    watch: true,
  };
};

export const discoverPackages = async (root: string): Promise<Package[]> => {
  const directories = await readdir(join(root, PACKAGE_LAYOUT.directory), {
    withFileTypes: true,
  });
  const candidates = directories
    .filter(
      (directory) =>
        directory.isDirectory() &&
        !directory.name.startsWith(PACKAGE_LAYOUT.dashboardPrefix)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const packages = await Promise.all(
    candidates.map((directory) => discoverPackage(root, directory.name))
  );
  return packages.filter((item): item is Package => item !== undefined);
};

export const readPresets = async (
  root: string,
  personalPath: string
): Promise<Preset[]> => {
  const shared = StoredPreset.array().parse(
    JSON.parse(
      await readFile(join(root, DASHBOARD_PATHS.sharedPresets), "utf8")
    )
  );

  let personal: Preset[] = [];
  try {
    personal = StoredPreset.array().parse(
      JSON.parse(await readFile(personalPath, "utf8"))
    );
  } catch (error) {
    if (!isFileNotFoundError(error)) throw error;
  }
  const ids = new Set<string>();

  const presets = [...shared, ...personal];
  presets.forEach((preset) => {
    if (ids.has(preset.id))
      throw new Error(`Duplicate preset id: ${preset.id}`);
    ids.add(preset.id);
  });
  if (
    shared.some((p) => p.source !== "shared") ||
    personal.some((p) => p.source !== "personal")
  )
    throw new Error("Invalid preset ownership");
  return presets;
};
