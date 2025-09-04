import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
  },
  resolve: {
    alias: {
      "pagopa-interop-commons-test": resolve(__dirname, "./packages/commons-test/src"),
      "pagopa-interop-models": resolve(__dirname, "./packages/models/src"),
      "../gen": resolve(__dirname, "./packages/models/gen"),
    },
  },
});