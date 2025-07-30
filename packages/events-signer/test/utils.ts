import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { inject } from "vitest";

export const eventSignerConfig = inject("eventsSignerConfig" as never);

if (!eventSignerConfig) {
  throw genericInternalError("Invalid eventSignerConfig config");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${eventSignerConfig.safeStoragePort}`,
});

export const eventsSignerTable = eventSignerConfig;
