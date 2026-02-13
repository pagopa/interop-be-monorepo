import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./open-api/notificationConfigApi.yml",
  output: "src/generated/hey-api/notificationConfigApi",
  plugins: [
    "@hey-api/typescript",
    "zod",
    {
      name: "@hey-api/sdk",
    },
    "@hey-api/client-fetch",
    "fastify",
  ],
});
