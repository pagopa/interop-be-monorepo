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
    testTimeout: 60_000, // it doesn't change anything, the underscore only serves to increase readability
    hookTimeout: 60_000,
    fileParallelism: false,
    pool: "forks",
    // Vitest 3 has automatic caching. These (clearMocks, restoreMocks, mockReset) are used to disable it completely in the tests and ensure “cleanliness”
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    reporters: ["default"], // It helps improve the readability of CI tests
    env: { FEATURE_FLAG_SQL: "false" },
    watch: false,
  },
});
