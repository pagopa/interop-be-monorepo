import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestGlobalSetup.ts"],
    testTimeout: 120000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    reporters: ["verbose"],
    include: ["test/output.test.ts"],
  },
});
