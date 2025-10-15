import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { inject } from "vitest";

export const dynamoDBClientConfig = inject("dynamoDBClientConfig");

if (!dynamoDBClientConfig) {
  throw genericInternalError("Invalid DynamoDBClientConfig config");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${dynamoDBClientConfig.dynamoDbTestPort}`,
});
