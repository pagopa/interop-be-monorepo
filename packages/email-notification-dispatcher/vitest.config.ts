import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv-flow";

loadEnv({ silent: true });

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestGlobalSetup.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    watch: false,
    reporters: ["verbose"],
  },
});
