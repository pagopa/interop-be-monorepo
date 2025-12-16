/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
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
