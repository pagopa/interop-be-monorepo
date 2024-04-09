import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["dotenv/config", "test/agreementService.test.setup.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
