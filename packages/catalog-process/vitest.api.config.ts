import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestAPISetup.ts"],
    include: ["./test/api/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
  },
});
