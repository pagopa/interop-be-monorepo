import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { inject } from "vitest";
import { DPoPConfig } from "../src/config.js";

const tokenGenReadModelConfig = inject("tokenGenerationReadModelConfig");
if (!tokenGenReadModelConfig) {
  throw genericInternalError(
    "Token generation read model config is not defined"
  );
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${tokenGenReadModelConfig.tokenGenerationReadModelDbPort}`,
});

const dpopConfig = DPoPConfig.safeParse(process.env);
if (!dpopConfig.success) {
  throw genericInternalError("Invalid DPoP config");
}

export const dpopCacheTable = dpopConfig.data.dpopCacheTable;
