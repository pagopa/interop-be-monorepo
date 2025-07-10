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
    include: ["./test/integration/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    pool: "forks",
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    reporters: ["default"],
    env: { FEATURE_FLAG_SQL: "false" },
  },
});
