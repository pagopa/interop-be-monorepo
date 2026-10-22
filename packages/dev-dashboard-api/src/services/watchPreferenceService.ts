import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

import { isFileNotFoundError } from "../utilities/errorUtils.js";

const WatchPreferences = z.record(z.boolean());

export async function readWatchPreferences(
  path: string
): Promise<Record<string, boolean>> {
  try {
    return WatchPreferences.parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (!isFileNotFoundError(error)) throw error;
    return {};
  }
}

export async function persistWatchPreferences(
  path: string,
  preferences: Record<string, boolean>
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(preferences, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
