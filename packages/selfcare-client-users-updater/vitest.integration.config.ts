import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*this-pattern-matches-no-files*"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
  },
});
