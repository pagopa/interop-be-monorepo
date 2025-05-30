import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:8085`,
  region: "eu-south-1",
  credentials: {
    accessKeyId: "key",
    secretAccessKey: "secret",
  },
});

export const dpopCacheTable = "dpop-cache";
