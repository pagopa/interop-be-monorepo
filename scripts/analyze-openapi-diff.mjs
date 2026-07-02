import { execSync } from "node:child_process";
import { parse } from "yaml";

const BASE_BRANCH = "develop";
const TARGET_BRANCH = "origin/PIN-10000_refactor-api-spec";
const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

// --- Parsing ---

function extractOperations(yamlContent) {
  const spec = parse(yamlContent);
  if (!spec.paths) return new Map();
  const ops = new Map();

  for (const [, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue;
      ops.set(operation.operationId, {
        method: method.toUpperCase(),
        responses: Object.keys(operation.responses ?? {}).sort(),
      });
    }
  }

  return ops;
}

// --- Get changed YAML files via git diff ---

function getChangedYamlFiles() {
  const output = execSync(`git diff ${BASE_BRANCH}...${TARGET_BRANCH} --name-only -- '*.yml' '*.yaml'`, {
    encoding: "utf8",
  });
  return output
    .trim()
    .split("\n")
    .filter((f) => f.includes("open-api"));
}

// --- Analyze a single file ---

function analyzeFile(filePath) {
  let targetContent;
  try {
    targetContent = execSync(`git show ${TARGET_BRANCH}:${filePath}`, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    console.log(`  File does not exist on ${TARGET_BRANCH}, skipping.\n`);
    return false;
  }

  let developContent;
  try {
    developContent = execSync(`git show ${BASE_BRANCH}:${filePath}`, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch {
    console.log(`  File does not exist on ${BASE_BRANCH} (new file).\n`);
    return false;
  }

  const current = extractOperations(targetContent);
  const develop = extractOperations(developContent);

  if (current.size === 0 && develop.size === 0) {
    console.log(`  No operations found (not an OpenAPI paths file).\n`);
    return false;
  }

  const allOperationIds = [...new Set([...develop.keys(), ...current.keys()])].sort();
  const diffs = [];

  for (const id of allOperationIds) {
    const dev = develop.get(id);
    const cur = current.get(id);

    if (!dev) {
      diffs.push(`+ ${id}: ${cur.method} [${cur.responses.join(", ")}] (added)`);
      continue;
    }
    if (!cur) {
      diffs.push(`- ${id}: ${dev.method} [${dev.responses.join(", ")}] (removed)`);
      continue;
    }

    const changes = [];
    if (dev.method !== cur.method) changes.push(`method: ${dev.method} → ${cur.method}`);

    const addedResponses = cur.responses.filter((r) => !dev.responses.includes(r));
    const removedResponses = dev.responses.filter((r) => !cur.responses.includes(r));
    if (addedResponses.length) changes.push(`+responses: [${addedResponses.join(", ")}]`);
    if (removedResponses.length) changes.push(`-responses: [${removedResponses.join(", ")}]`);

    if (changes.length) diffs.push(`~ ${id}: ${changes.join(" | ")}`);
  }

  // Print side-by-side
  for (const id of allOperationIds) {
    const dev = develop.get(id);
    const cur = current.get(id);
    const devStr = dev ? `${dev.method} [${dev.responses.join(", ")}]` : "(missing)";
    const curStr = cur ? `${cur.method} [${cur.responses.join(", ")}]` : "(missing)";
    const marker = devStr !== curStr ? " ← CHANGED" : "";
    console.log(`  ${id}`);
    console.log(`    develop: ${devStr}`);
    console.log(`    current: ${curStr}${marker}`);
  }

  if (diffs.length === 0) {
    console.log(`\n  No differences.\n`);
  } else {
    console.log(`\n  ${diffs.length} difference(s):`);
    for (const d of diffs) console.log(`    ${d}`);
    console.log();
  }

  return diffs.length > 0;
}

// --- Main ---

const yamlFiles = getChangedYamlFiles();

if (yamlFiles.length === 0) {
  console.log("No open-api YAML files changed vs develop.");
  process.exit(0);
}

console.log(`${yamlFiles.length} open-api YAML file(s) changed vs ${BASE_BRANCH}:\n`);

let hasDiffs = false;

for (const file of yamlFiles) {
  console.log(`=== ${file} ===`);
  if (analyzeFile(file)) hasDiffs = true;
}

if (hasDiffs) process.exit(1);
