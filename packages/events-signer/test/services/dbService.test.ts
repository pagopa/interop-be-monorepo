import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { generateId } from "pagopa-interop-models";
import { dbServiceBuilder } from "pagopa-interop-commons";
import {
  createTableIfNotExists,
  dynamoDBClient,
  waitForTable,
} from "../utils/utils.js";
import { config } from "../../src/config/config.js";

describe("dbServiceBuilder - Integration Tests", () => {
  beforeAll(async () => {
    await createTableIfNotExists(config.signatureReferencesTableName);
    await waitForTable(config.signatureReferencesTableName);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("should successfully save a signature reference and retrieve it", async () => {
    const safeStorageId = generateId();
    const dbService = dbServiceBuilder(dynamoDBClient, config);
    const mockReference = {
      safeStorageId,
      fileKind: "INTEROP_LEGAL_FACTS",
      fileName: "multa.pdf",
      correlationId: generateId(),
    };

    await dbService.saveSignatureReference(mockReference);

    const retrievedItem = await dbService.readSignatureReference(
      mockReference.safeStorageId
    );

    expect(retrievedItem).toEqual({
      ...mockReference,
      safeStorageId: mockReference.safeStorageId,
    });
  });

  it("should return undefined if a signature reference does not exist", async () => {
    const nonExistentId = generateId();
    const dbService = dbServiceBuilder(dynamoDBClient, config);
    const retrievedItem = await dbService.readSignatureReference(nonExistentId);

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
    const dbService = dbServiceBuilder(brokenDynamoDBClient, config);
    await expect(
      dbService.readSignatureReference(generateId())
    ).rejects.toThrow();
  });
});
