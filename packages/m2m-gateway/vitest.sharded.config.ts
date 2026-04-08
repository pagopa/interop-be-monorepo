import { defineConfig } from "vitest/config";
import "dotenv-flow/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestIntegrationGlobalSetup.ts"],
    setupFiles: "./test/vitest.api.setup.ts",
    include: ["./test/api/**/*.test.ts", "./test/integration/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    reporters: ["verbose"],
  },
});
