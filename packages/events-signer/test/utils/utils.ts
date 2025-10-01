/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { inject } from "vitest";

export const eventSignerConfig = inject("eventsSignerConfig");

if (!eventSignerConfig) {
  throw genericInternalError("Invalid eventSignerConfig config");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${eventSignerConfig.safeStoragePort}`,
});
