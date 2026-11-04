import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverRunnablePackages } from "pagopa-interop-dev-dashboard-bootstrap";
import { Preset, type Package } from "pagopa-interop-dev-dashboard-contracts";
import { z } from "zod";

import { DASHBOARD_PATHS } from "../config/constants.js";
import { isFileNotFoundError } from "../utilities/errorUtils.js";

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

export const discoverPackages = async (root: string): Promise<Package[]> =>
  (await discoverRunnablePackages(root)).map(({ name, directory, port }) => ({
    name,
    label: directory,
    kind: packageKind(directory, port),
    ...(port === undefined ? {} : { port }),
    state: "stopped",
    watch: true,
  }));

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
