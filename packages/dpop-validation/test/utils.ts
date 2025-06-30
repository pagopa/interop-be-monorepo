import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { inject } from "vitest";

export const dpopConfig = inject("dpopConfig");
if (!dpopConfig) {
  throw genericInternalError("Invalid DPoP config");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${dpopConfig.dpopDbPort}`,
});

export const dpopCacheTable = dpopConfig.dpopCacheTable;
