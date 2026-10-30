import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  persistWatchPreferences,
  readWatchPreferences,
} from "../src/services/watchPreferenceService.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  );
});

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "dashboard-watch-storage-"));
  directories.push(root);
  return root;
};

describe("local dashboard watch preferences", () => {
  it("uses defaults when the preference file does not exist", async () => {
    const root = await fixture();
    await expect(
      readWatchPreferences(join(root, "dashboard/watch.json"))
    ).resolves.toEqual({});
  });

  it.each(["not json", "null", "[]", '{"a":"false"}'])(
    "rejects malformed stored preferences: %s",
    async (contents) => {
      const root = await fixture();
      const path = join(root, "watch.json");
      await writeFile(path, contents);
      await expect(readWatchPreferences(path)).rejects.toThrow();
    }
  );

  it("reports read errors instead of replacing preferences with defaults", async () => {
    const root = await fixture();
    await expect(readWatchPreferences(root)).rejects.toThrow();
  });

  it("loads the latest saved choices without leaving temporary files", async () => {
    const root = await fixture();
    const path = join(root, "dashboard/watch.json");
    await persistWatchPreferences(path, { a: false, b: true });
    await expect(readWatchPreferences(path)).resolves.toEqual({
      a: false,
      b: true,
    });
    await persistWatchPreferences(path, { a: true, b: false });
    await expect(readWatchPreferences(path)).resolves.toEqual({
      a: true,
      b: false,
    });
    expect(await readdir(join(root, "dashboard"))).toEqual(["watch.json"]);
  });

  it("cleans up a failed write without replacing its destination", async () => {
    const root = await fixture();
    const path = join(root, "watch.json");
    await mkdir(path);
    await writeFile(join(path, "existing"), "Keep existing data");
    await expect(persistWatchPreferences(path, { a: false })).rejects.toThrow();
    expect(await readdir(root)).toEqual(["watch.json"]);
    expect(await readdir(path)).toEqual(["existing"]);
  });
});
