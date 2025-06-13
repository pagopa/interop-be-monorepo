import { defineConfig } from "vitest/config";

// export default defineConfig({
//   test: {
//     globalSetup: ["./test/vitestIntegrationGlobalSetup.ts"],
//     include: ["./test/integration/**/*.test.ts"],
//     testTimeout: 60000,
//     hookTimeout: 60000,
//     fileParallelism: false,
//     pool: "forks",
//     env: { FEATURE_FLAG_SQL: "false" },
//     watch: false,
//   },
// });

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestIntegrationGlobalSetup.ts"],
    include: ["./test/integrationProva/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: "forks",
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    reporters: ["default", "verbose"],
    env: {
      FEATURE_FLAG_SQL: "false",
      TESTCONTAINERS_REUSE_ENABLE: "true",
    },
    watch: false,
  },
});
