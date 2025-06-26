import { defineConfig } from "vitest/config";
import "dotenv-flow/config";

export default defineConfig({
  test: {
    setupFiles: "",
    globalSetup: ["./test/vitestIntegrationGlobalSetup.ts"],
    /* ^ No global setup needed for this package,	
    as it does not need any container to be started	
    at the moment */
    include: ["./test/integration/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    watch: false,
  },
});
