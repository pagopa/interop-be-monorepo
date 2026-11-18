import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import { PACKAGE_LAYOUT } from "../config/constants.js";
import { PackageManifest } from "../model/domain/models.js";

const readPackageManifest = async (
  root: string,
  directory: string
): Promise<z.infer<typeof PackageManifest>> =>
  PackageManifest.parse(
    JSON.parse(
      await readFile(
        join(
          root,
          PACKAGE_LAYOUT.directory,
          directory,
          PACKAGE_LAYOUT.manifest
        ),
        "utf8"
      )
    )
  );

export const directoryForName = async (
  root: string,
  name: string
): Promise<string> => {
  const directories = await readdir(join(root, PACKAGE_LAYOUT.directory), {
    withFileTypes: true,
  });
  for (const directory of directories.filter((entry) => entry.isDirectory())) {
    try {
      const manifest = await readPackageManifest(root, directory.name);
      if (manifest.name === name) return directory.name;
    } catch {
      /* Non-workspace folders have no manifest. */
    }
  }
  throw new Error(`Unknown package: ${name}`);
};
