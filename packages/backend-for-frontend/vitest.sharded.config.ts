import { defineConfig } from "vitest/config";
import "dotenv-flow/config";

export default defineConfig({
  test: {
    reporters: ["verbose"],
    projects: ["./vitest.config.ts", "./vitest.api.config.ts"],
  },
});
