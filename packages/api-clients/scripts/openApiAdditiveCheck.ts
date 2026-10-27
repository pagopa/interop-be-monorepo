import SwaggerParser from "@apidevtools/swagger-parser";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const specPath = "packages/api-clients/open-api/bffApi.yml";
// Declarations in the PR description are read only after this marker.
const declarationMarker = "BFF_API_CHANGES_TO_EXISTING";
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

type KeyedDiff = { added: string[]; removed: string[]; modified: string[] };

function diffByKey(
  base: Map<string, unknown>,
  head: Map<string, unknown>
): KeyedDiff {
  const diff: KeyedDiff = { added: [], removed: [], modified: [] };

  for (const key of new Set([...base.keys(), ...head.keys()])) {
    if (!base.has(key)) {
      diff.added.push(key);
    } else if (!head.has(key)) {
      diff.removed.push(key);
    } else if (!isDeepStrictEqual(base.get(key), head.get(key))) {
      diff.modified.push(key);
    }
  }

  return {
    added: diff.added.sort(),
    removed: diff.removed.sort(),
    modified: diff.modified.sort(),
  };
}

// Keyed by "METHOD /path".
function collectOperations(spec: OpenApiSpec): Map<string, unknown> {
  const operations = new Map<string, unknown>();

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    // Path-level fields (e.g. shared parameters) count as part of every operation.
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

// Keyed by "<componentType>/<name>", e.g. "schemas/EService".
function collectComponents(spec: OpenApiSpec): Map<string, unknown> {
  return new Map(
    Object.entries(spec.components ?? {}).flatMap(([type, definitions]) =>
      Object.entries(definitions).map(
        ([name, definition]) => [`${type}/${name}`, definition] as const
      )
    )
  );
}

function collectTags(spec: OpenApiSpec): Map<string, unknown> {
  return new Map((spec.tags ?? []).map((tag) => [tag.name, tag] as const));
}

export function compareOpenApiSpecs(
  baseSpec: OpenApiSpec,
  headSpec: OpenApiSpec
): OpenApiAdditiveDiff {
  const operations = diffByKey(
    collectOperations(baseSpec),
    collectOperations(headSpec)
  );
  const components = diffByKey(
    collectComponents(baseSpec),
    collectComponents(headSpec)
  );
  const tags = diffByKey(collectTags(baseSpec), collectTags(headSpec));
  const changedGlobals = (["servers", "security"] as const).filter(
    (key) => !isDeepStrictEqual(baseSpec[key], headSpec[key])
  );

  return {
    addedOperations: operations.added,
    removedOperations: operations.removed,
    modifiedOperations: operations.modified,
    addedComponents: components.added,
    removedComponents: components.removed,
    modifiedComponents: components.modified,
    addedTags: tags.added,
    removedTags: tags.removed,
    modifiedTags: tags.modified,
    changedGlobals,
    baseVersion: baseSpec.info?.version,
    headVersion: headSpec.info?.version,
  };
}

export function formatReport(
  diff: OpenApiAdditiveDiff,
  unreferencedChanges?: string[]
): string {
  const failed = unreferencedChanges
    ? unreferencedChanges.length > 0
    : hasNonAdditiveChanges(diff);
  const lines = [
    "BFF OpenAPI additive comparison",
    `Status: ${failed ? "FAIL" : "PASS"}`,
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
    ["Missing in the PR description", unreferencedChanges ?? []],
  ];

  for (const [title, entries] of sections) {
    if (entries.length > 0) {
      lines.push("", `${title}:`, ...entries.map((entry) => `  ${entry}`));
    }
  }

  if (unreferencedChanges && unreferencedChanges.length > 0) {
    lines.push(
      "",
      "Add this block to the PR description (one line per change, after the marker):",
      "",
      declarationMarker,
      ...unreferencedChanges
    );
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

function operationIdOf(spec: OpenApiSpec, operationKey: string): string {
  const separator = operationKey.indexOf(" ");
  const method = operationKey.slice(0, separator).toLowerCase();
  const path = operationKey.slice(separator + 1);
  const operation = spec.paths?.[path]?.[method] as
    | { operationId?: string }
    | undefined;
  return operation?.operationId ?? operationKey;
}

// e.g. "edited endpoint getEServiceById", "deleted component EService".
function requiredDeclarations(
  diff: OpenApiAdditiveDiff,
  baseSpec: OpenApiSpec,
  headSpec: OpenApiSpec
): string[] {
  const componentName = (key: string): string =>
    key.slice(key.indexOf("/") + 1);
  const declarations = [
    ...diff.modifiedOperations.map(
      (k) => `edited endpoint ${operationIdOf(headSpec, k)}`
    ),
    ...diff.removedOperations.map(
      (k) => `deleted endpoint ${operationIdOf(baseSpec, k)}`
    ),
    ...diff.modifiedComponents.map(
      (k) => `edited component ${componentName(k)}`
    ),
    ...diff.removedComponents.map(
      (k) => `deleted component ${componentName(k)}`
    ),
    ...diff.modifiedTags.map((name) => `edited tag ${name}`),
    ...diff.removedTags.map((name) => `deleted tag ${name}`),
    ...diff.changedGlobals.map((name) => `edited global ${name}`),
  ];
  // schemas/Foo and responses/Foo yield the same declaration.
  return [...new Set(declarations)];
}

// "<edited|deleted> <kind> <name>", optionally bulleted and wrapped in backticks.
const declarationLine =
  /^\s*(?:[-*]\s+)?`?(edited|deleted)\s+(endpoint|component|tag|global)\s+([\w.-]+)`?\s*$/i;

// Only lines after the marker count; other lines are ignored.
function parseDeclaredChanges(description: string | undefined): Set<string> {
  const text = description ?? "";
  const markerIndex = text.indexOf(declarationMarker);
  const declared = new Set<string>();
  if (markerIndex === -1) {
    return declared;
  }

  for (const line of text
    .slice(markerIndex + declarationMarker.length)
    .split(/\r?\n/)) {
    const match = declarationLine.exec(line);
    if (match) {
      declared.add(
        `${match[1].toLowerCase()} ${match[2].toLowerCase()} ${match[3]}`
      );
    }
  }
  return declared;
}

export function findUnreferencedChanges(
  diff: OpenApiAdditiveDiff,
  baseSpec: OpenApiSpec,
  headSpec: OpenApiSpec,
  prDescription: string | undefined
): string[] {
  const declared = parseDeclaredChanges(prDescription);
  return requiredDeclarations(diff, baseSpec, headSpec).filter(
    (declaration) => !declared.has(declaration)
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
  const unreferencedChanges = findUnreferencedChanges(
    diff,
    baseSpec,
    headSpec,
    process.env.OPENAPI_PR_DESCRIPTION
  );
  const report = formatReport(diff, unreferencedChanges);

  console.log(report);

  if (unreferencedChanges.length > 0) {
    throw new Error(
      `OpenAPI additive check failed: existing operations or shared definitions changed without being declared in the PR description. Add a ${declarationMarker} line followed by one line per change, e.g. "edited endpoint <operationId>" or "deleted component <name>" (see the report above)`
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
