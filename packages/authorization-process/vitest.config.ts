import { defineConfig } from "vitest/config";
import path from "path";
import "dotenv-flow/config";

import apiConfig from "./vitest.api.config.js";
import integrationConfig from "./vitest.integration.config.js";

// Identifies the path from which the command was executed
const testPath = process.argv.find((arg) => arg.includes(".test.ts"));

// States which configuration to load based on the test path
function getConfigBasedOnTestPath() {
  if (!testPath) {
    throw new Error(
      "Test path is undefined. Cannot determine test configuration."
    );
  }

  const normalizedPath = path.normalize(testPath);

  if (
    normalizedPath.includes("/test/api/") ||
    normalizedPath.includes("\\test\\api\\")
  ) {
    return apiConfig;
  }
  if (
    normalizedPath.includes("/test/integration/") ||
    normalizedPath.includes("\\test\\integration\\")
  ) {
    return integrationConfig;
  }

  throw new Error("No matching configuration found for the test path.");
}

export default defineConfig(getConfigBasedOnTestPath());
