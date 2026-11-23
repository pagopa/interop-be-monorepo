import { defineConfig } from "vitest/config";
import "dotenv-flow/config";

export default defineConfig({
  test: {
    setupFiles: "./test/vitest.auth.setup.ts",
    include: ["./test/auth/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    reporters: ["verbose"],
  },
});
