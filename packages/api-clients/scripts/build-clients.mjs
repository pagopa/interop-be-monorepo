#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

const projects = [
  "tsconfig.rest.json",
  "tsconfig.bffApi.json",
  "tsconfig.m2mGatewayApi.json",
  "tsconfig.m2mGatewayApiV3.json",
  "tsconfig.barrel.json",
];

const heapCapMb = process.env.API_CLIENTS_BUILD_HEAP_MB ?? "4096";
const tscBin = join(
  packageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc"
);

const childEnv = {
  ...process.env,
  NODE_OPTIONS:
    `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=${heapCapMb}`.trim(),
};

for (const project of projects) {
  const startedAt = Date.now();
  console.log(
    `\n[api-clients build] tsc -b ${project} (max-old-space-size=${heapCapMb}MB)`
  );
  const result = spawnSync(tscBin, ["-b", project], {
    cwd: packageRoot,
    stdio: "inherit",
    env: childEnv,
  });
  if (result.error) {
    console.error(`[api-clients build] spawn error on ${project}:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(
      `[api-clients build] FAILED on ${project} (exit ${result.status})`
    );
    process.exit(result.status ?? 1);
  }
  console.log(
    `[api-clients build] OK ${project} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  );
}

console.log("\n[api-clients build] all sub-projects built successfully");
