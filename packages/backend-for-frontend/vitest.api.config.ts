import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv-flow";

loadEnv({ silent: true });

export default defineConfig({
  test: {
    setupFiles: "./test/vitest.api.setup.ts",
    include: ["./test/api/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    reporters: ["verbose"],
  },
});
