/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { inject } from "vitest";

export const DynamoDBClientConfig = inject("dynamoDBClientConfig");

if (!DynamoDBClientConfig) {
  throw genericInternalError("Invalid DynamoDBClientConfig config");
}

export const dynamoDBClient = new DynamoDBClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: "fakeAccessKeyId",
    secretAccessKey: "fakeSecretAccessKey",
  },
  endpoint: `http://localhost:${DynamoDBClientConfig.dynamoDbTestPort}`,
});
