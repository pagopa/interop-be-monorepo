import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["dotenv/config", "./setuptest"],
    testTimeout: 60000,
  },
});
