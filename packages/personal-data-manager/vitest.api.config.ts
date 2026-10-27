import { defineConfig } from "vitest/config";
import "dotenv-flow/config";

export default defineConfig({
  test: {
    include: ["./test/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
