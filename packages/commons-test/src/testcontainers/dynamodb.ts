import type {} from "vitest";

import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TokenGenerationReadModelDbConfig } from "pagopa-interop-commons";
import { GenericContainer, type StartedNetwork } from "testcontainers";
import { match } from "ts-pattern";

const DYNAMODB_PORT = 8000;
const DYNAMODB_IMAGE = "amazon/dynamodb-local:3.3.0";
const DYNAMODB_NETWORK_ALIAS = "dynamodb-local";

const DYNAMO_TABLES_PATH = fileURLToPath(
  new URL(`../../../../docker/dynamo-db/schema`, import.meta.url)
);

/**
 * !!! Intended to be called once in global test setup !!!
 *
 *  Starts the shared DynamoDB Local test container and runs the same
 *  setup script used by Docker Compose to create tables (and TTL configs)
 *  from the schemas in `dynamo-tables/`.
 */
export async function setupDynamoDBTestContainer(network: StartedNetwork) {
  const container = await new GenericContainer(DYNAMODB_IMAGE)
    .withName("pagopa-interop-dynamodb-test-container")
    .withLabels({ "com.docker.compose.project": "pagopa-interop-test" })
    .withNetwork(network)
    .withNetworkAliases(DYNAMODB_NETWORK_ALIAS)
    .withExposedPorts(DYNAMODB_PORT)
    .withCommand(["-jar", "DynamoDBLocal.jar", "-inMemory", "-sharedDb"])
    .withReuse()
    .start();

  const host = container.getHost();
  const mappedPort = container.getMappedPort(DYNAMODB_PORT);
  const endpoint = `http://${host}:${mappedPort}`;

  return { container, endpoint };
}

/**
 * Returns the canonical DynamoDB table name for a given TokenGenerationReadModelDbConfig key.
 * The .exhaustive() call ensures at compile time that all config keys are covered —
 * add a new entry here whenever a field is added to TokenGenerationReadModelDbConfig.
 */
function tableNameForConfigKey(
  key: keyof TokenGenerationReadModelDbConfig
): string {
  return match(key)
    .with("tokenGenerationReadModelTableNamePlatform", () => "platform-states")
    .with(
      "tokenGenerationReadModelTableNameTokenGeneration",
      () => "token-generation-states"
    )
    .exhaustive();
}
const CONFIG_KEYS = [
  "tokenGenerationReadModelTableNamePlatform",
  "tokenGenerationReadModelTableNameTokenGeneration",
] satisfies Array<keyof TokenGenerationReadModelDbConfig>;

/**
 * Creates a dedicated set of DynamoDB tables for a single test file by reading
 * all schema files from the schema directory and creating each table with a
 * unique suffix appended to its name.
 *
 * Intended to be called in beforeAll of each test file.
 */
export async function setupDynamoDBTestTables(
  endpoint: string,
  config: TokenGenerationReadModelDbConfig
): Promise<{ dynamoDBClient: DynamoDBClient; dynamoDbTablesSuffix: string }> {
  const dynamoDBClient = new DynamoDBClient({
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    endpoint,
    region: "eu-south-1",
  });
  const suffix = crypto.randomUUID();

  const schemaFiles = readdirSync(DYNAMO_TABLES_PATH).filter((f) =>
    f.endsWith(".json")
  );

  await Promise.all(
    schemaFiles.map(async (file) => {
      const schema = JSON.parse(
        readFileSync(join(DYNAMO_TABLES_PATH, file), "utf-8")
      );
      const suffixedTableName = `${schema.TableName}-${suffix}`;
      await dynamoDBClient.send(
        new CreateTableCommand({ ...schema, TableName: suffixedTableName })
      );
      for (const key of CONFIG_KEYS) {
        if (tableNameForConfigKey(key) === schema.TableName) {
          config[key] = suffixedTableName;
        } else {
          throw new Error(
            `No matching config key found for table ${schema.TableName}`
          );
        }
      }
    })
  );

  return { dynamoDBClient, dynamoDbTablesSuffix: suffix };
}

declare module "vitest" {
  export interface ProvidedContext {
    DYNAMODB_CONNECTION_STRING: string;
  }
}
