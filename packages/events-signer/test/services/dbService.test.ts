import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  buildDynamoDBTables,
  deleteDynamoDBTables,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { readSignatureReference } from "../utils/dbServiceUtils.js";
import { dbServiceBuilder } from "../../src/services/dbService.js";
import { dynamoDBClient } from "../utils/utils.js";

describe("dbServiceBuilder - Integration Tests", () => {
  beforeEach(async () => {
    await buildDynamoDBTables(dynamoDBClient);
  });
  afterEach(async () => {
    await deleteDynamoDBTables(dynamoDBClient);
  });

  it("should successfully save a signature reference and retrieve it", async () => {
    const safeStorageId = generateId();
    const dbService = dbServiceBuilder(dynamoDBClient);
    const mockReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "multa.pdf",
      correlationId: generateId(),
    };

    await dbService.saveSignatureReference(mockReference);

    const retrievedItem = await readSignatureReference(
      mockReference.safeStorageId,
      dynamoDBClient
    );

    expect(retrievedItem).toEqual({
      ...mockReference,
      PK: mockReference.safeStorageId,
    });
  });

  it("should return undefined if a signature reference does not exist", async () => {
    const nonExistentId = generateId();

    const retrievedItem = await readSignatureReference(
      nonExistentId,
      dynamoDBClient
    );

    expect(retrievedItem).toBeUndefined();
  });

  it("should handle error when reading from DynamoDB", async () => {
    const brokenDynamoDBClient = new DynamoDBClient({
      region: "eu-south-1",
      endpoint: "http://localhost:9999",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });

    await expect(
      readSignatureReference(generateId(), brokenDynamoDBClient)
    ).rejects.toThrow();
  });
});
