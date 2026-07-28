import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { TokenGenerationReadModelDbConfig } from "pagopa-interop-commons";
import {
  resetDynamoTables,
  setupDynamoDBTestTables,
} from "pagopa-interop-commons-test";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

// TODO: The src utils functions depend on the original config var. They must be refactored to use the injected config instead of the original one, so that we can remove this import and create a test config.
import { config } from "../../src/config/config.js";

let dynamoDBClient: DynamoDBClient;
let dynamoDbTablesSuffix: string;

async function resetTestDatabases(config: TokenGenerationReadModelDbConfig) {
  await Promise.all([resetDynamoTables(dynamoDBClient, config)]);
}

beforeAll(async () => {
  ({ dynamoDBClient, dynamoDbTablesSuffix } = await setupDynamoDBTestTables(
    inject("DYNAMODB_CONNECTION_STRING"),
    config
  ));
});

afterEach(async () => {
  await resetTestDatabases(config);
});

afterAll(async () => {
  dynamoDBClient.destroy();
});

export { dynamoDBClient, dynamoDbTablesSuffix };
