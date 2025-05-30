import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { DPoPConfig } from "../src/config.js";

const config = DPoPConfig.safeParse(process.env);
if (!config.success) {
  throw genericInternalError("Invalid config");
}

export const dynamoDBClient = new DynamoDBClient();

export const dpopCacheTable = config.data.dpopCacheTable;
