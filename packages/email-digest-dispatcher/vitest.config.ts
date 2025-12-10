import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["dotenv-flow/config"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
