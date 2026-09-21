import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["./test/unit/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    reporters: ["verbose"],
  },
});
