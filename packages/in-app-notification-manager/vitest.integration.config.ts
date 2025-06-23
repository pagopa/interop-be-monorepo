import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestIntegrationGlobalSetup.ts"],
    include: ["./test/integration/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    watch: false,
  },
});
