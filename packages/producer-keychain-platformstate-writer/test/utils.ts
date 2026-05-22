import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  CreateTableCommand,
  CreateTableInput,
  DeleteTableCommand,
  DeleteTableInput,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { ProducerKeychainPlatformStatesPK } from "pagopa-interop-models";
import { inject } from "vitest";
import { ProducerKeychainPlatformStateEntry } from "../src/utils.js";

const config = inject("tokenGenerationReadModelConfig");

if (!config) {
  throw new Error("config is not defined");
}

export const tableName = "producer-keychain-platform-states";

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${config.tokenGenerationReadModelDbPort}`,
});

export const buildProducerKeychainPlatformStatesTable =
  async (): Promise<void> => {
    const schemaPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../docker/dynamo-db/schema/producer-keychain-platform-states-dynamo-db.json"
    );

    const tableDefinition: CreateTableInput = JSON.parse(
      readFileSync(schemaPath, "utf-8")
    );

    await dynamoDBClient.send(new CreateTableCommand(tableDefinition));
  };

export const deleteProducerKeychainPlatformStatesTable =
  async (): Promise<void> => {
    const deleteInput: DeleteTableInput = {
      TableName: tableName,
    };

    try {
      await dynamoDBClient.send(new DeleteTableCommand(deleteInput));
    } catch {
      // no-op
    }
  };

export const writeProducerKeychainPlatformStateEntry = async (
  entry: ProducerKeychainPlatformStateEntry
): Promise<void> => {
  await dynamoDBClient.send(
    new PutItemCommand({
      TableName: tableName,
      Item: marshall(entry, {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      }),
    })
  );
};

export const readProducerKeychainPlatformStateEntry = async (
  pk: ProducerKeychainPlatformStatesPK
): Promise<ProducerKeychainPlatformStateEntry | undefined> => {
  const result = await dynamoDBClient.send(
    new GetItemCommand({
      TableName: tableName,
      Key: {
        PK: { S: pk },
      },
      ConsistentRead: true,
    })
  );

  return result.Item
    ? (unmarshall(result.Item) as ProducerKeychainPlatformStateEntry)
    : undefined;
};

export const readAllProducerKeychainPlatformStatesEntries = async (): Promise<
  ProducerKeychainPlatformStateEntry[]
> => {
  const result = await dynamoDBClient.send(
    new ScanCommand({
      TableName: tableName,
    })
  );

  return (result.Items ?? []).map(
    (item) => unmarshall(item) as ProducerKeychainPlatformStateEntry
  );
};
