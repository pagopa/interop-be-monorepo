import { defineConfig, mergeConfig } from "vitest/config";
import rootConfig from "../../vitest.config.js";
import "dotenv-flow/config";

export default mergeConfig(
  rootConfig,
  defineConfig({
    test: {
      setupFiles: "./test/vitest.api.setup.ts",
      include: ["./test/api/**/*.test.ts"],
    },
  })
);
