/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { genericInternalError } from "pagopa-interop-models";
import { inject } from "vitest";

export const eventSignerConfig = inject("eventsSignerConfig");

if (!eventSignerConfig) {
  throw genericInternalError("Invalid eventSignerConfig config");
}

export const dynamoDBClient = new DynamoDBClient({
  endpoint: `http://localhost:${eventSignerConfig.safeStoragePort}`,
});

export async function createTableIfNotExists(tableName: string) {
  try {
    await dynamoDBClient.send(
      new DescribeTableCommand({ TableName: tableName })
    );
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      await dynamoDBClient.send(
        new CreateTableCommand({
          TableName: tableName,
          KeySchema: [{ AttributeName: "safeStorageId", KeyType: "HASH" }],
          AttributeDefinitions: [
            { AttributeName: "safeStorageId", AttributeType: "S" },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        })
      );
    } else {
      throw err;
    }
  }
}

export async function waitForTable(tableName: string) {
  let status = "";
  while (status !== "ACTIVE") {
    try {
      const resp = await dynamoDBClient.send(
        new DescribeTableCommand({ TableName: tableName })
      );
      status = resp.Table?.TableStatus ?? "";
    } catch (err: any) {
      if (err.name === "ResourceNotFoundException") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
    if (status !== "ACTIVE") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
