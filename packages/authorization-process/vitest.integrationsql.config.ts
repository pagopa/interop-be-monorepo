import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config.js";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      globalSetup: ["./test/vitestIntegrationGlobalSetup.ts"],
      include: ["./test/integration/**/*.test.ts"],
      env: { FEATURE_FLAG_SQL: "true" },
    },
  })
);
