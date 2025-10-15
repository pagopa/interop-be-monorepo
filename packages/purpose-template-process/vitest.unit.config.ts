import { defineConfig } from "vitest/config";
import "dotenv-flow/config";
export default defineConfig({
  test: {
    setupFiles: "./test/vitest.unit.setup.ts",
    include: ["./test/unit/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
  },
});
