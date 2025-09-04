import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globalSetup: ["./test/vitestGlobalSetup.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
  },
 resolve: {
    alias: {
      "pagopa-interop-commons-test": resolve(__dirname, "./src"),
      "pagopa-interop-models": resolve(__dirname, "../models/src"),
    },
  },
});
