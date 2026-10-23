import SwaggerParser from "@apidevtools/swagger-parser";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const specPath = "packages/api-clients/open-api/bffApi.yml";
const operationMethods = new Set([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

type OpenApiSpec = {
  components?: Record<string, Record<string, unknown>>;
  info?: { version?: string };
  paths?: Record<string, Record<string, unknown>>;
  security?: unknown;
  servers?: unknown;
  tags?: Array<{ name: string; [key: string]: unknown }>;
};

export type OpenApiAdditiveDiff = {
  addedOperations: string[];
  removedOperations: string[];
  modifiedOperations: string[];
  addedComponents: string[];
  removedComponents: string[];
  modifiedComponents: string[];
  changedGlobals: string[];
  addedTags: string[];
  removedTags: string[];
  modifiedTags: string[];
  baseVersion?: string;
  headVersion?: string;
};

function collectOperations(spec: OpenApiSpec): Map<string, unknown> {
  const operations = new Map<string, unknown>();

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    const pathProperties = Object.fromEntries(
      Object.entries(pathItem).filter(
        ([key]) => !operationMethods.has(key.toLowerCase())
      )
    );

    for (const [method, operation] of Object.entries(pathItem)) {
      if (operationMethods.has(method.toLowerCase())) {
        const key = `${method.toUpperCase()} ${path}`;
        operations.set(key, { pathProperties, operation });
      }
    }
  }

  return operations;
}

function compareNamedDefinitions(
  base: Record<string, unknown>,
  head: Record<string, unknown>,
  prefix: string
): Pick<
  OpenApiAdditiveDiff,
  "addedComponents" | "removedComponents" | "modifiedComponents"
> {
  const addedComponents: string[] = [];
  const removedComponents: string[] = [];
  const modifiedComponents: string[] = [];

  for (const name of new Set([...Object.keys(base), ...Object.keys(head)])) {
    const key = `${prefix}/${name}`;
    if (!(name in base)) {
      addedComponents.push(key);
    } else if (!(name in head)) {
      removedComponents.push(key);
    } else if (!isDeepStrictEqual(base[name], head[name])) {
      modifiedComponents.push(key);
    }
  }

  return { addedComponents, removedComponents, modifiedComponents };
}

function compareTags(
  baseTags: OpenApiSpec["tags"] = [],
  headTags: OpenApiSpec["tags"] = []
): Pick<OpenApiAdditiveDiff, "addedTags" | "removedTags" | "modifiedTags"> {
  const base = new Map(baseTags.map((tag) => [tag.name, tag]));
  const head = new Map(headTags.map((tag) => [tag.name, tag]));
  const addedTags: string[] = [];
  const removedTags: string[] = [];
  const modifiedTags: string[] = [];

  for (const name of new Set([...base.keys(), ...head.keys()])) {
    if (!base.has(name)) {
      addedTags.push(name);
    } else if (!head.has(name)) {
      removedTags.push(name);
    } else if (!isDeepStrictEqual(base.get(name), head.get(name))) {
      modifiedTags.push(name);
    }
  }

  return { addedTags, removedTags, modifiedTags };
}

export function compareOpenApiSpecs(
  baseSpec: OpenApiSpec,
  headSpec: OpenApiSpec
): OpenApiAdditiveDiff {
  const baseOperations = collectOperations(baseSpec);
  const headOperations = collectOperations(headSpec);
  const addedOperations: string[] = [];
  const removedOperations: string[] = [];
  const modifiedOperations: string[] = [];

  for (const key of new Set([
    ...baseOperations.keys(),
    ...headOperations.keys(),
  ])) {
    if (!baseOperations.has(key)) {
      addedOperations.push(key);
    } else if (!headOperations.has(key)) {
      removedOperations.push(key);
    } else if (
      !isDeepStrictEqual(baseOperations.get(key), headOperations.get(key))
    ) {
      modifiedOperations.push(key);
    }
  }

  const baseComponents = baseSpec.components ?? {};
  const headComponents = headSpec.components ?? {};
  const componentDiffs = {
    addedComponents: [] as string[],
    removedComponents: [] as string[],
    modifiedComponents: [] as string[],
  };

  for (const componentType of new Set([
    ...Object.keys(baseComponents),
    ...Object.keys(headComponents),
  ])) {
    const diff = compareNamedDefinitions(
      baseComponents[componentType] ?? {},
      headComponents[componentType] ?? {},
      componentType
    );
    componentDiffs.addedComponents.push(...diff.addedComponents);
    componentDiffs.removedComponents.push(...diff.removedComponents);
    componentDiffs.modifiedComponents.push(...diff.modifiedComponents);
  }

  const changedGlobals = (["servers", "security"] as const).filter(
    (key) => !isDeepStrictEqual(baseSpec[key], headSpec[key])
  );

  return {
    addedOperations: addedOperations.sort(),
    removedOperations: removedOperations.sort(),
    modifiedOperations: modifiedOperations.sort(),
    addedComponents: componentDiffs.addedComponents.sort(),
    removedComponents: componentDiffs.removedComponents.sort(),
    modifiedComponents: componentDiffs.modifiedComponents.sort(),
    changedGlobals: [...changedGlobals],
    ...compareTags(baseSpec.tags, headSpec.tags),
    baseVersion: baseSpec.info?.version,
    headVersion: headSpec.info?.version,
  };
}

export function formatReport(diff: OpenApiAdditiveDiff): string {
  const lines = [
    "BFF OpenAPI additive comparison",
    `Status: ${hasNonAdditiveChanges(diff) ? "FAIL" : "PASS"}`,
    "",
    `Spec version: ${diff.baseVersion ?? "unknown"} -> ${diff.headVersion ?? "unknown"}`,
    `New endpoints: ${diff.addedOperations.length}`,
    `Existing endpoints modified: ${diff.modifiedOperations.length}`,
    `Existing endpoints removed: ${diff.removedOperations.length}`,
    `New components: ${diff.addedComponents.length}`,
    `Existing components modified: ${diff.modifiedComponents.length}`,
    `Existing components removed: ${diff.removedComponents.length}`,
    `Tags added: ${diff.addedTags.length}`,
    `Existing tags modified: ${diff.modifiedTags.length}`,
    `Existing tags removed: ${diff.removedTags.length}`,
    `Changed global settings: ${diff.changedGlobals.length}`,
  ];

  const sections: Array<[string, string[]]> = [
    ["New endpoints", diff.addedOperations],
    ["Modified existing operations", diff.modifiedOperations],
    ["Removed existing endpoints", diff.removedOperations],
    ["New components", diff.addedComponents],
    ["Modified existing components", diff.modifiedComponents],
    ["Removed existing components", diff.removedComponents],
    ["New tags", diff.addedTags],
    ["Modified existing tags", diff.modifiedTags],
    ["Removed existing tags", diff.removedTags],
    ["Changed global settings", diff.changedGlobals],
  ];

  for (const [title, entries] of sections) {
    if (entries.length > 0) {
      lines.push("", `${title}:`, ...entries.map((entry) => `  ${entry}`));
    }
  }

  return `${lines.join("\n")}\n`;
}

export function hasNonAdditiveChanges(diff: OpenApiAdditiveDiff): boolean {
  return (
    diff.modifiedOperations.length > 0 ||
    diff.removedOperations.length > 0 ||
    diff.modifiedComponents.length > 0 ||
    diff.removedComponents.length > 0 ||
    diff.changedGlobals.length > 0 ||
    diff.modifiedTags.length > 0 ||
    diff.removedTags.length > 0
  );
}

async function parseSpecAtCommit(commit: string): Promise<OpenApiSpec> {
  const content = execFileSync("git", ["show", `${commit}:${specPath}`], {
    encoding: "utf8",
  });
  const tempDirectory = mkdtempSync(join(tmpdir(), "openapi-additive-check-"));
  const tempPath = join(tempDirectory, "bffApi.yml");

  try {
    writeFileSync(tempPath, content);
    return (await SwaggerParser.parse(tempPath)) as OpenApiSpec;
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const baseSha = process.env.OPENAPI_BASE_SHA;
  const headSha = process.env.OPENAPI_HEAD_SHA;

  if (!baseSha || !headSha) {
    throw new Error("OPENAPI_BASE_SHA and OPENAPI_HEAD_SHA must be set");
  }

  const [baseSpec, headSpec] = await Promise.all([
    parseSpecAtCommit(baseSha),
    parseSpecAtCommit(headSha),
  ]);
  const diff = compareOpenApiSpecs(baseSpec, headSpec);
  const report = formatReport(diff);

  console.log(report);

  if (hasNonAdditiveChanges(diff)) {
    throw new Error(
      "OpenAPI additive check failed: existing operations or shared definitions changed"
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
