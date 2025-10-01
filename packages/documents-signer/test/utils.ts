import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { inject } from "vitest";

const config = inject("tokenGenerationReadModelConfig");

if (!config) {
  throw new Error("config is not defined");
}
export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
  region: "eu-south-1",
  credentials: {
    accessKeyId: "dummy",
    secretAccessKey: "dummy",
  },
});
