import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath: string): Record<string, string> {
  const fullPath = resolve(process.cwd(), filePath);
  if (!existsSync(fullPath)) return {};

  const content = readFileSync(fullPath, "utf-8");
  const env: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (key) env[key] = valueParts.join("=");
  }

  return env;
}

export default defineConfig({
  test: {
    globalSetup: ["./globalTestSetup.mts"],
    projects: ["packages/*"],
    env: loadEnvFile(".env.test"),
  },
});
