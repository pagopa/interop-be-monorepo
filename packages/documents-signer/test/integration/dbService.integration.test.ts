/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  CreateTableCommand,
  DescribeTableCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { describe, it, expect, beforeAll } from "vitest";
import { config } from "../../src/config/config.js";
import { dbServiceBuilder } from "../../src/services/dbService.js";
import { dynamoDBClient } from "../utils.js";

interface DocumentReference {
  safeStorageKey: string;
  fileKind: string;
  streamId: string;
  subObjectId: string;
  fileName: string;
  version: number;
}

async function createTableIfNotExists(tableName: string) {
  try {
    await dynamoDBClient.send(
      new DescribeTableCommand({ TableName: tableName })
    );
  } catch (err: any) {
    if (err.name === "ResourceNotFoundException") {
      await dynamoDBClient.send(
        new CreateTableCommand({
          TableName: tableName,
          KeySchema: [{ AttributeName: "safeStorageKey", KeyType: "HASH" }],
          AttributeDefinitions: [
            { AttributeName: "safeStorageKey", AttributeType: "S" },
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

async function waitForTable(tableName: string) {
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

describe("dbServiceBuilder integration with DynamoDB", () => {
  let dbService: ReturnType<typeof dbServiceBuilder>;

  beforeAll(async () => {
    await createTableIfNotExists(config.dbTableName);
    await waitForTable(config.dbTableName);
    dbService = dbServiceBuilder(dynamoDBClient);
  });

  it("should build the DB service", () => {
    expect(dbService).toBeDefined();
  });

  it("should write and read a DocumentReference", async () => {
    const doc: DocumentReference = {
      safeStorageKey: "key-123",
      fileKind: "pdf",
      streamId: "stream-456",
      subObjectId: "sub-789",
      fileName: "document.pdf",
      version: 1,
    };

    await dbService.saveDocumentReference(doc);

    const resp = await dynamoDBClient.send(
      new GetItemCommand({
        TableName: config.dbTableName,
        Key: { safeStorageKey: { S: doc.safeStorageKey } },
      })
    );

    expect(resp.Item).toBeDefined();
    expect(resp.Item?.fileName.S).toBe(doc.fileName);
    expect(Number(resp.Item?.version.N)).toBe(doc.version);
    expect(resp.Item?.safeStorageKey.S).toBe(doc.safeStorageKey);
  });
});
