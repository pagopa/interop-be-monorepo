import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["verbose"],
    projects: ["./vitest.api.config.ts", "./vitest.integration.config.ts"],
  },
});
