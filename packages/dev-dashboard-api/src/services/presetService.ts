import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PresetInput,
  type Package,
  type Preset,
} from "pagopa-interop-dev-dashboard-contracts";

import { DASHBOARD_PATHS } from "../config/constants.js";

type PresetServiceOptions = {
  beRoot: string;
  personalPath?: string;
  presets: Preset[];
  getPackage: (name: string) => Package;
};

type PresetService = {
  get: (id: string) => Preset;
  list: () => Preset[];
  save: (input: unknown) => Promise<Preset>;
  delete: (id: string) => Promise<void>;
};

export function presetServiceBuilder(
  options: PresetServiceOptions
): PresetService {
  let presets: Preset[] = structuredClone(options.presets);
  let presetWrites: Promise<void> = Promise.resolve();
  const getPackage = options.getPackage;

  function getPreset(id: string): Preset {
    const preset = presets.find((p) => p.id === id);
    if (!preset) throw new Error(`Unknown preset: ${id}`);
    return preset;
  }

  async function savePreset(input: unknown): Promise<Preset> {
    return serializePreset(async () => {
      const data = PresetInput.parse(input);
      data.packages.forEach((member) => {
        getPackage(member.name);
      });
      if (
        new Set(data.packages.map((p) => p.name)).size !== data.packages.length
      )
        throw new Error("Duplicate preset packages");
      const existing = data.id
        ? presets.find((p) => p.id === data.id)
        : undefined;
      if (existing?.source === "shared")
        throw new Error("Shared presets cannot be edited");
      const preset: Preset = {
        ...data,
        id: data.id ?? randomUUID(),
        source: "personal",
      };
      const next = [...presets.filter((p) => p.id !== preset.id), preset];
      await persist(next);
      presets = next;
      return structuredClone(preset);
    });
  }

  async function deletePreset(id: string): Promise<void> {
    return serializePreset(async () => {
      const preset = getPreset(id);
      if (preset.source !== "personal")
        throw new Error("Shared presets cannot be deleted");
      const next = presets.filter((p) => p.id !== id);
      await persist(next);
      presets = next;
    });
  }

  function serializePreset<T>(task: () => Promise<T>): Promise<T> {
    const result = presetWrites.then(task);
    presetWrites = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  async function persist(presets: Preset[]): Promise<void> {
    const path =
      options.personalPath ??
      join(options.beRoot, DASHBOARD_PATHS.personalPresets);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(
      temporary,
      `${JSON.stringify(
        presets.filter((p) => p.source === "personal"),
        null,
        2
      )}\n`,
      { mode: 0o600 }
    );
    await rename(temporary, path);
  }

  return {
    get: getPreset,
    list: (): Preset[] => presets,
    save: savePreset,
    delete: deletePreset,
  };
}
