import { defineConfig } from "vitest/config";
import "dotenv-flow/config";

export default defineConfig({
  test: {
    reporters: ["verbose"],
    projects: ["./vitest.api.config.ts", "./vitest.integration.config.ts"],
  },
});
