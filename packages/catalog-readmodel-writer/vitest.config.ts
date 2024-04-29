import { defineConfig } from "vitest/config";
import "dotenv-flow"

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
