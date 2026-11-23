import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import "dotenv-flow/config";

export default defineConfig({
  resolve: {
    alias: {
      "kafka-iam-auth": fileURLToPath(
        new URL("./test/kafkaIamAuthMock.ts", import.meta.url)
      ),
    },
  },
  test: {
    setupFiles: [
      "./test/vitest.logCapture.setup.ts",
      "./test/vitest.api.setup.ts",
    ],
    include: ["./test/api/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    pool: "forks",
    reporters: ["verbose"],
    env: {
      NODE_ENV: "development",
    },
  },
});
